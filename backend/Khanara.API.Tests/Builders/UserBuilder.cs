using Khanara.API.Entities;
using Microsoft.AspNetCore.Identity;

namespace Khanara.API.Tests.Builders;

public class UserBuilder
{
    private string _email = "test@example.com";
    private string _displayName = "Test User";
    private string[] _roles = { "Eater" };

    public UserBuilder WithEmail(string email)
    {
        _email = email;
        return this;
    }

    public UserBuilder WithDisplayName(string displayName)
    {
        _displayName = displayName;
        return this;
    }

    public UserBuilder WithRoles(params string[] roles)
    {
        _roles = roles;
        return this;
    }

    public UserBuilder AsCook()
    {
        _roles = new[] { "Cook", "Eater" };
        return this;
    }

    public UserBuilder AsAdmin()
    {
        _roles = new[] { "Admin" };
        return this;
    }

    public async Task<AppUser> BuildAsync(UserManager<AppUser> userManager, string password = "Test123!@#")
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid().ToString(),
            Email = _email,
            UserName = _email,
            DisplayName = _displayName,
            EmailConfirmed = true
        };

        await userManager.CreateAsync(user, password);
        if (_roles.Length > 0)
            await userManager.AddToRolesAsync(user, _roles);

        return user;
    }
}
