using System.Net;
using System.Net.Http.Json;
using Khanara.API.Data;
using Khanara.API.DTOs;
using Khanara.API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Tests.Integration;

public class SeedTests : BaseIntegrationTest
{
    // The password that used to be committed in Seed.cs for the catalog's cooks
    private const string CommittedSeedPassword = "K@h4n@r@Seed2025!";

    public SeedTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Fact]
    public async Task RemoveSeedCookPasswords_SeedCooksCanNoLongerLogIn()
    {
        // Arrange
        await AuthHelper.CreateUserAsync("indiancook@khanara.seed", CommittedSeedPassword, "Cook");
        var before = await Client.PostAsJsonAsync("/api/account/login",
            new LoginDto { Email = "indiancook@khanara.seed", Password = CommittedSeedPassword });
        before.StatusCode.Should().Be(HttpStatusCode.OK);
        DbContext.ChangeTracker.Clear(); // the login above updated the user in another scope

        // Act
        await Seed.RemoveSeedCookPasswords(UserManager);

        // Assert
        var after = await Client.PostAsJsonAsync("/api/account/login",
            new LoginDto { Email = "indiancook@khanara.seed", Password = CommittedSeedPassword });
        after.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        DbContext.ChangeTracker.Clear();
        var user = await DbContext.Users.AsNoTracking().SingleAsync(u => u.Email == "indiancook@khanara.seed");
        user.PasswordHash.Should().BeNull();
        user.RefreshToken.Should().BeNull();
    }

    [Fact]
    public async Task RemoveSeedCookPasswords_LeavesRealAccountsAlone()
    {
        // Arrange
        await AuthHelper.CreateUserAsync("cook@example.com", "RealCookPass123", "Cook");

        // Act
        await Seed.RemoveSeedCookPasswords(UserManager);

        // Assert
        var response = await Client.PostAsJsonAsync("/api/account/login",
            new LoginDto { Email = "cook@example.com", Password = "RealCookPass123" });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
