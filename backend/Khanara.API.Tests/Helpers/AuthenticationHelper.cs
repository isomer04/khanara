using Khanara.API.Entities;
using Khanara.API.Interfaces;
using Khanara.API.Tests.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Khanara.API.Tests.Helpers;

public class AuthenticationHelper
{
    private readonly UserManager<AppUser> _userManager;
    private readonly IServiceProvider _services;

    public AuthenticationHelper(UserManager<AppUser> userManager, IServiceProvider services)
    {
        _userManager = userManager;
        _services = services;
    }

    public async Task<AppUser> CreateUserAsync(string email, string password, params string[] roles)
    {
        // If the user already exists (e.g. created earlier in the same test via a helper
        // method, then referenced again via CreateAuthenticatedClient), return the existing
        // user rather than failing with a duplicate-email error.
        var existing = await _userManager.FindByEmailAsync(email);
        if (existing != null)
            return existing;

        var user = new AppUser
        {
            Id = Guid.NewGuid().ToString(),
            Email = email,
            UserName = email,
            DisplayName = email.Split('@')[0],
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(user, password);
        if (!result.Succeeded)
            throw new InvalidOperationException($"Failed to create user: {string.Join(", ", result.Errors.Select(e => e.Description))}");

        if (roles.Length > 0)
        {
            var roleResult = await _userManager.AddToRolesAsync(user, roles);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException($"Failed to add roles to user: {string.Join(", ", roleResult.Errors.Select(e => e.Description))}");
        }

        return user;
    }

    public async Task<string> GenerateJwtTokenAsync(AppUser user)
    {
        using var scope = _services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        return await tokenService.CreateToken(user);
    }

    public async Task<HttpClient> CreateClientForExistingUserAsync(AppUser user, CustomWebApplicationFactory factory)
    {
        var token = await GenerateJwtTokenAsync(user);
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public async Task<(AppUser User, string Token)> CreateAuthenticatedUserAsync(
        string email, string password, params string[] roles)
    {
        var user = await CreateUserAsync(email, password, roles);
        var token = await GenerateJwtTokenAsync(user);
        return (user, token);
    }
}
