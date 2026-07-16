using System.Net;
using System.Net.Http.Json;
using Khanara.API.Tests.Helpers;
using Khanara.API.Tests.Infrastructure;

namespace Khanara.API.Tests.Integration.Controllers;

public class AdminControllerTests : BaseIntegrationTest
{
    public AdminControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Fact]
    public async Task GetUsersWithRoles_AsAdmin_ReturnsUserList()
    {
        // Arrange
        var admin = await AuthHelper.CreateUserAsync("admin@test.com", "AdminPass123!@#", "Admin");
        var user1 = await AuthHelper.CreateUserAsync("user1@test.com", "UserPass123!@#", "Eater");
        var user2 = await AuthHelper.CreateUserAsync("user2@test.com", "UserPass123!@#", "Cook", "Eater");

        var adminClient = await CreateAuthenticatedClient("admin@test.com", "AdminPass123!@#", "Admin");

        // Act
        var response = await adminClient.GetAsync("/api/admin/users-with-roles");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var users = await response.Content.ReadFromJsonAsync<List<dynamic>>();
        users.Should().NotBeNull();
        users.Should().HaveCountGreaterOrEqualTo(3);
    }

    [Fact]
    public async Task EditUserRoles_AsAdmin_UpdatesRoles()
    {
        // Arrange
        var admin = await AuthHelper.CreateUserAsync("admin@test.com", "AdminPass123!@#", "Admin");
        var user = await AuthHelper.CreateUserAsync("user@test.com", "UserPass123!@#", "Eater");

        var adminClient = await CreateAuthenticatedClient("admin@test.com", "AdminPass123!@#", "Admin");

        // Act - Add Cook role
        var response = await adminClient.PostAsync($"/api/admin/edit-roles/{user.Id}?roles=Eater,Cook", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var roles = await response.Content.ReadFromJsonAsync<List<string>>();
        roles.Should().NotBeNull();
        roles.Should().Contain("Eater");
        roles.Should().Contain("Cook");

        // Verify in database
        var userRoles = await UserManager.GetRolesAsync(user);
        userRoles.Should().Contain("Cook");
    }

    [Fact]
    public async Task AdminOperation_AsNonAdmin_ReturnsForbidden()
    {
        // Arrange
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await eaterClient.GetAsync("/api/admin/users-with-roles");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
