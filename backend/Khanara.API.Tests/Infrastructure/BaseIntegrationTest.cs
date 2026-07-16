using System.Net.Http.Headers;
using System.Net.Http.Json;
using Khanara.API.Data;
using Khanara.API.Entities;
using Khanara.API.Tests.Helpers;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Khanara.API.Tests.Infrastructure;

public abstract class BaseIntegrationTest : IClassFixture<CustomWebApplicationFactory>, IAsyncLifetime
{
    protected readonly CustomWebApplicationFactory Factory;
    protected readonly HttpClient Client;
    protected readonly AppDbContext DbContext;
    protected readonly UserManager<AppUser> UserManager;
    protected readonly AuthenticationHelper AuthHelper;
    
    private readonly IServiceScope _scope;

    protected BaseIntegrationTest(CustomWebApplicationFactory factory)
    {
        Factory = factory;
        Client = factory.CreateClient();

        _scope = factory.Services.CreateScope();
        DbContext = _scope.ServiceProvider.GetRequiredService<AppDbContext>();
        UserManager = _scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        AuthHelper = new AuthenticationHelper(UserManager, factory.Services);
    }

    /// <summary>
    /// Resets all application data between tests while preserving roles.
    /// Called automatically before each test via IAsyncLifetime.InitializeAsync.
    /// </summary>
    protected async Task ResetDatabaseAsync()
    {
        // Delete in dependency order to avoid FK violations
        DbContext.StripeWebhookEvents.RemoveRange(DbContext.StripeWebhookEvents);
        DbContext.Reviews.RemoveRange(DbContext.Reviews);
        DbContext.Messages.RemoveRange(DbContext.Messages);
        DbContext.OrderItems.RemoveRange(DbContext.OrderItems);
        DbContext.Orders.RemoveRange(DbContext.Orders);
        DbContext.CartItems.RemoveRange(DbContext.CartItems);
        DbContext.Favorites.RemoveRange(DbContext.Favorites);
        DbContext.DishPhotos.RemoveRange(DbContext.DishPhotos);
        DbContext.Dishes.RemoveRange(DbContext.Dishes);
        DbContext.CookProfiles.RemoveRange(DbContext.CookProfiles);
        DbContext.Photos.RemoveRange(DbContext.Photos);

        // Remove all users (roles are preserved via seeding)
        var users = await UserManager.Users.ToListAsync();
        foreach (var user in users)
            await UserManager.DeleteAsync(user);

        await DbContext.SaveChangesAsync();

        // Clear the change tracker so subsequent reads go to the DB
        DbContext.ChangeTracker.Clear();
    }

    // IAsyncLifetime: runs before each test
    public virtual async Task InitializeAsync()
    {
        await ResetDatabaseAsync();
    }

    // IAsyncLifetime: runs after each test
    public virtual async Task DisposeAsync()
    {
        try
        {
            Client?.Dispose();
            _scope?.Dispose();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Disposal error: {ex.Message}");
        }

        GC.SuppressFinalize(this);
        await Task.CompletedTask;
    }

    protected async Task<HttpClient> CreateAuthenticatedClient(string email, string password, params string[] roles)
    {
        var user = await AuthHelper.CreateUserAsync(email, password, roles);
        var token = await AuthHelper.GenerateJwtTokenAsync(user);

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        return client;
    }

    protected async Task<HttpClient> CreateClientForUser(AppUser user)
    {
        return await AuthHelper.CreateClientForExistingUserAsync(user, Factory);
    }

    protected async Task<T> GetFromJsonAsync<T>(string url)
    {
        var response = await Client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>()
            ?? throw new InvalidOperationException("Response deserialization failed");
    }

    protected async Task<HttpResponseMessage> PostAsJsonAsync<T>(string url, T data)
    {
        return await Client.PostAsJsonAsync(url, data);
    }
}
