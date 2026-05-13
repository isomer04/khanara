using System.Text;
using System.Threading.RateLimiting;
using Khanara.API.Data;
using Khanara.API.Entities;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Khanara.API.Middleware;
using Khanara.API.Services;
using Khanara.API.SignalR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

var runtimeEnvironment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
var isTestEnvironment = runtimeEnvironment.Equals("Test", StringComparison.OrdinalIgnoreCase);

if (!isTestEnvironment)
{
    var tokenKeyValidation = builder.Configuration["TokenKey"]
        ?? throw new InvalidOperationException("TokenKey is not configured.");
    if (tokenKeyValidation.Length < 64)
        throw new InvalidOperationException("TokenKey must be at least 64 characters long.");

    if (string.IsNullOrWhiteSpace(builder.Configuration["Jwt:Issuer"]))
        throw new InvalidOperationException("Jwt:Issuer is not configured.");
    if (string.IsNullOrWhiteSpace(builder.Configuration["Jwt:Audience"]))
        throw new InvalidOperationException("Jwt:Audience is not configured.");

    if (string.IsNullOrWhiteSpace(builder.Configuration["CloudinarySettings:CloudName"]))
        throw new InvalidOperationException("CloudinarySettings:CloudName is not configured.");
    if (string.IsNullOrWhiteSpace(builder.Configuration["CloudinarySettings:ApiKey"]))
        throw new InvalidOperationException("CloudinarySettings:ApiKey is not configured.");
    if (string.IsNullOrWhiteSpace(builder.Configuration["CloudinarySettings:ApiSecret"]))
        throw new InvalidOperationException("CloudinarySettings:ApiSecret is not configured.");

    if (string.IsNullOrWhiteSpace(builder.Configuration["Stripe:SecretKey"]))
        throw new InvalidOperationException("Stripe:SecretKey is not configured.");
    if (string.IsNullOrWhiteSpace(builder.Configuration["Stripe:WebhookSecret"]))
        throw new InvalidOperationException("Stripe:WebhookSecret is not configured.");
}

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddDbContext<AppDbContext>(opt =>
{
    opt.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddCors();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IPhotoService, PhotoService>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<OrderNotificationService>();
builder.Services.Configure<CloudinarySettings>(builder.Configuration.GetSection("CloudinarySettings"));
builder.Services.AddSignalR();
builder.Services.AddSingleton<OrderPresenceTracker>();

builder.Services.Configure<StripeSettings>(builder.Configuration.GetSection("Stripe"));
Stripe.StripeConfiguration.ApiKey = builder.Configuration["Stripe:SecretKey"];
builder.Services.AddScoped<IStripeService, StripeService>();
builder.Services.AddHostedService<AbandonedOrderCleanupService>();
builder.Services.AddHostedService<DailyPortionsResetService>();

builder.Services.AddRateLimiter(options =>
{
    // Per-IP fixed window: configurable limit on auth endpoints (default 10/min, override in test config)
    var permitLimit = builder.Configuration.GetValue<int>("RateLimiting:AuthPermitLimit", 10);
    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

builder.Services.AddIdentityCore<AppUser>(opt =>
{
    opt.Password.RequiredLength = 12;
    opt.Password.RequireUppercase = true;
    opt.Password.RequireLowercase = true;
    opt.Password.RequireDigit = true;
    opt.Password.RequireNonAlphanumeric = false;
    opt.User.RequireUniqueEmail = true;
    opt.Lockout.MaxFailedAccessAttempts = 5;
    opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    opt.Lockout.AllowedForNewUsers = true;
})
.AddRoles<IdentityRole>()
.AddEntityFrameworkStores<AppDbContext>()
.AddSignInManager<SignInManager<AppUser>>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Read lazily so WebApplicationFactory's ConfigureAppConfiguration runs first
        var jwtTokenKey = builder.Configuration["TokenKey"]
            ?? throw new InvalidOperationException("TokenKey is not configured.");

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtTokenKey)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"]
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    context.Token = accessToken;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("RequireAdminRole", policy => policy.RequireRole("Admin"))
    .AddPolicy("ModeratePhotoRole", policy => policy.RequireRole("Admin", "Moderator"))
    .AddPolicy("RequireCookRole", policy => policy.RequireRole("Cook"));

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
    o.MultipartBodyLengthLimit = 5 * 1024 * 1024); // 5 MB

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Khanara API",
        Version = "v1",
        Description = "Home-cooked food marketplace for Asian and Arabian communities"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT access token"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            []
        }
    });
});

// ── Pipeline ──────────────────────────────────────────────────────────────────
var app = builder.Build();

app.UseMiddleware<ExceptionMiddleware>();

// HTTPS redirect must come before static files so image requests are also redirected
app.UseHttpsRedirection();

// HSTS — only in non-development environments
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

// Security headers
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
    context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // Content-Security-Policy: tighten as needed; this baseline blocks inline scripts and unknown origins
    context.Response.Headers.Append("Content-Security-Policy",
        "default-src 'self'; " +
        "img-src 'self' https://res.cloudinary.com data:; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "script-src 'self'; " +
        "connect-src 'self' https://js.stripe.com wss:; " +
        "frame-src https://js.stripe.com; " +
        "object-src 'none'; " +
        "base-uri 'self';");
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Khanara API v1"));
}

var allowedOrigins = app.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? throw new InvalidOperationException("Cors:AllowedOrigins is not configured.");
app.UseCors(x =>
    x.AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()
    .WithOrigins(allowedOrigins));

// Static files — served after HTTPS redirect so all image URLs are HTTPS
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(app.Environment.ContentRootPath, "wwwroot", "images", "dishes")),
    RequestPath = "/images/dishes",
    OnPrepareResponse = ctx =>
    {
        // Uploaded dish images are effectively immutable — cache aggressively
        ctx.Context.Response.Headers.Append("Cache-Control", "public, max-age=31536000, immutable");
    }
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(app.Environment.ContentRootPath, "wwwroot", "images", "kitchens")),
    RequestPath = "/images/kitchens",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "public, max-age=31536000, immutable");
    }
});

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<OrderHub>("hubs/order", options =>
{
    options.CloseOnAuthenticationExpiration = true;
});

// Skip database initialization in Test environment (handled by test infrastructure)
if (!app.Environment.IsEnvironment("Test"))
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        var userManager = services.GetRequiredService<UserManager<AppUser>>();
        await context.Database.MigrateAsync();
        await Seed.SeedUsers(userManager, context);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred during migration");
    }
}

app.Run();

// Make the implicit Program class public for testing
public partial class Program { }
