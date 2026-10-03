using System.Text;
using System.Text.RegularExpressions;
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
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.Rewrite;
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

    // Without in-process timers the jobs only run when Cloud Scheduler can call JobsController.
    if (!builder.Configuration.GetValue("Jobs:RunInProcess", true))
    {
        if (string.IsNullOrWhiteSpace(builder.Configuration["Jobs:OidcAudience"]))
            throw new InvalidOperationException("Jobs:OidcAudience is not configured.");
        if (string.IsNullOrWhiteSpace(builder.Configuration["Jobs:SchedulerServiceAccountEmail"]))
            throw new InvalidOperationException("Jobs:SchedulerServiceAccountEmail is not configured.");
    }
}

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddControllers();
if (!isTestEnvironment)
{
    builder.Services.AddDbContext<AppDbContext>(opt =>
    {
        opt.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
    });
}

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

builder.Services.AddScoped<AbandonedOrderCleanupJob>();
builder.Services.AddScoped<DailyPortionsResetJob>();
// In-process timers need an always-on instance. Cloud Run scales to zero, so
// there Jobs:RunInProcess=false and Cloud Scheduler calls JobsController instead.
if (builder.Configuration.GetValue("Jobs:RunInProcess", true))
{
    builder.Services.AddHostedService<AbandonedOrderCleanupService>();
    builder.Services.AddHostedService<DailyPortionsResetService>();
}

builder.Services.AddHealthChecks();

// Cloud Run doesn't compress responses, so the SPA bundles would go out raw.
// JSON is left out on purpose: API responses carry tokens next to user input,
// the combination BREACH-style attacks need.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes =
    [
        "text/html", "text/css", "text/javascript", "application/javascript",
        "image/svg+xml", "text/plain", "application/manifest+json",
    ];
});

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

const string SchedulerJobScheme = "SchedulerOidc";

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
    })
    // Google-signed OIDC tokens sent by Cloud Scheduler to JobsController.
    .AddJwtBearer(SchedulerJobScheme, options =>
    {
        options.Authority = "https://accounts.google.com";
        options.MapInboundClaims = false; // keep the raw "email" claim
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuers = ["https://accounts.google.com", "accounts.google.com"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jobs:OidcAudience"]
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("RequireAdminRole", policy => policy.RequireRole("Admin"))
    .AddPolicy("ModeratePhotoRole", policy => policy.RequireRole("Admin", "Moderator"))
    .AddPolicy("RequireCookRole", policy => policy.RequireRole("Cook"))
    // Any Google service account can mint a token for our audience, so also
    // pin the caller to the scheduler's service account. Denies everything
    // when Jobs:SchedulerServiceAccountEmail is not configured.
    .AddPolicy("SchedulerJob", policy => policy
        .AddAuthenticationSchemes(SchedulerJobScheme)
        .RequireAuthenticatedUser()
        .RequireAssertion(context =>
        {
            var schedulerEmail = builder.Configuration["Jobs:SchedulerServiceAccountEmail"];
            return !string.IsNullOrWhiteSpace(schedulerEmail)
                && context.User.HasClaim("email", schedulerEmail)
                && context.User.HasClaim(c => c.Type == "email_verified"
                    && string.Equals(c.Value, "true", StringComparison.OrdinalIgnoreCase));
        }));

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
app.UseResponseCompression();

// www.khanara.shop → khanara.shop, so the host-only refresh cookie isn't split across two hosts
app.UseRewriter(new RewriteOptions().AddRedirectToNonWwwPermanent());

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
        Path.Combine(app.Environment.ContentRootPath, "Assets", "images", "dishes")),
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
        Path.Combine(app.Environment.ContentRootPath, "Assets", "images", "kitchens")),
    RequestPath = "/images/kitchens",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "public, max-age=31536000, immutable");
    }
});

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

// Shared by the static files middleware and the SPA fallback below, so
// index.html gets the same headers whichever of them serves it.
var spaFileOptions = new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Angular's content-hashed bundles (main-ABCD1234.js) never change, so
        // cache them for good. index.html must be revalidated so a deploy is
        // picked up; without an explicit header Cloud Run sends "private".
        var fileName = ctx.File.Name;
        ctx.Context.Response.Headers.CacheControl = HashedAssetName().IsMatch(fileName)
            ? "public, max-age=31536000, immutable"
            : fileName == "index.html" ? "no-cache" : "public, max-age=3600";
    }
};

app.UseDefaultFiles();
app.UseStaticFiles(spaFileOptions);

app.MapControllers();
app.MapHub<OrderHub>("hubs/order", options =>
{
    options.CloseOnAuthenticationExpiration = true;
});
// Not /healthz: Cloud Run reserves URL paths ending in "z" and never forwards them.
app.MapHealthChecks("/health");
// Unknown API routes (or a failed route constraint like /api/cooks/abc) are 404s;
// without this they'd fall through to the SPA and return index.html with a 200.
app.MapFallback("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html", spaFileOptions);

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
        await Seed.SeedUsers(userManager, context, app.Environment.IsDevelopment());
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred during migration");

        // Outside Development, fail the startup so a revision that can't reach its
        // database never passes its startup probe or takes traffic.
        if (!app.Environment.IsDevelopment()) throw;
    }
}

app.Run();

// Make the implicit Program class public for testing
public partial class Program
{
    [GeneratedRegex(@"-[A-Z0-9]{8}\.(js|css)$")]
    private static partial Regex HashedAssetName();
}
