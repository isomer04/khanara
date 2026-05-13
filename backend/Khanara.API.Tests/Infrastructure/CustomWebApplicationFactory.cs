using Khanara.API.Data;
using Khanara.API.Entities;
using Khanara.API.Interfaces;
using Khanara.API.Tests.Mocks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.IO;

namespace Khanara.API.Tests.Infrastructure;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private SqliteConnection? _connection;
    private bool _databaseInitialized = false;
    private readonly object _initLock = new object();
    
    public Mock<IStripeService> MockStripeService { get; } = new();
    public Mock<IPhotoService> MockPhotoService { get; } = new();

    public CustomWebApplicationFactory()
    {
        // Set the environment variable before Program.cs runs so startup validation
        // can detect the Test environment via Environment.GetEnvironmentVariable.
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Test");

        // Create and open connection immediately
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Set the environment first so the security check below and all subsequent
        // configuration reads see the correct value.
        builder.UseEnvironment("Test");

        // SECURITY: Validate we're in test environment.
        // We read from the builder's environment (set above) rather than the OS
        // env-var so this works in CI where ASPNETCORE_ENVIRONMENT may be unset.
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Test";
        if (environment != "Test" && environment != "Development")
        {
            throw new InvalidOperationException(
                $"SECURITY: Test factory must run in Test environment only! Current: {environment}");
        }

        builder.ConfigureAppConfiguration((context, config) =>
        {
            // Get the test project directory
            var testProjectPath = Directory.GetCurrentDirectory();
            
            // Load test configuration from test project directory
            config.AddJsonFile(Path.Combine(testProjectPath, "appsettings.Test.json"), optional: false, reloadOnChange: false);
        });

        builder.ConfigureServices(services =>
        {
            // SECURITY: Validate connection string is in-memory only
            var serviceProvider = services.BuildServiceProvider();
            var config = serviceProvider.GetRequiredService<IConfiguration>();
            var connectionString = config.GetConnectionString("DefaultConnection");
            
            if (!connectionString.Contains(":memory:", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "SECURITY: Test factory must use in-memory database only! " +
                    $"Current connection: {connectionString}");
            }
            // Remove production DbContext
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (descriptor != null)
                services.Remove(descriptor);

            // Add in-memory SQLite database using the persistent connection
            // CRITICAL: Pass the connection instance directly to ensure all DbContext instances use the same connection
            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseSqlite(_connection!);
                options.EnableSensitiveDataLogging();
            });

            // Replace external services with mocks
            var stripeDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IStripeService));
            if (stripeDescriptor != null)
                services.Remove(stripeDescriptor);
            services.AddScoped(_ => MockStripeService.Object);

            var photoDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IPhotoService));
            if (photoDescriptor != null)
                services.Remove(photoDescriptor);
            services.AddScoped(_ => MockPhotoService.Object);

            // Disable background services in tests
            var hostedServices = services.Where(d => d.ServiceType == typeof(IHostedService)).ToList();
            foreach (var service in hostedServices)
            {
                services.Remove(service);
            }
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);

        // Initialize database AFTER host is built to ensure we use the same connection
        lock (_initLock)
        {
            if (!_databaseInitialized)
            {
                using var scope = host.Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                
                // Verify we're using the correct connection
                var connection = db.Database.GetDbConnection();
                Console.WriteLine($"Connection in CreateHost: {connection.GetHashCode()}, State: {connection.State}");
                Console.WriteLine($"Original connection: {_connection?.GetHashCode()}, State: {_connection?.State}");
                
                // Create schema directly from model (avoids migration issues with SQLite in-memory)
                var created = db.Database.EnsureCreated();
                Console.WriteLine($"EnsureCreated returned: {created}");

                // Seed roles
                SeedRoles(scope.ServiceProvider).Wait();
                
                _databaseInitialized = true;
            }
        }

        return host;
    }

    private static async Task SeedRoles(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        string[] roles = { "Cook", "Eater", "Admin", "Moderator" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _connection?.Close();
            _connection?.Dispose();
        }
        base.Dispose(disposing);
    }
}
