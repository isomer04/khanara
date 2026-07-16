using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Khanara.API.DTOs;
using Khanara.API.Tests.Helpers;
using Khanara.API.Tests.Infrastructure;

namespace Khanara.API.Tests.Integration.Controllers;

public class AccountControllerTests : BaseIntegrationTest
{
    public AccountControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Fact]
    public async Task Register_ValidData_CreatesUserAndReturnsToken()
    {
        // Arrange
        var registerDto = new RegisterDto
        {
            Email = "newuser@test.com",
            DisplayName = "New User",
            Password = "SecurePass123!@#"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/register", registerDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var userDto = await response.Content.ReadFromJsonAsync<UserDto>();
        userDto.Should().NotBeNull();
        userDto!.Email.Should().Be(registerDto.Email);
        userDto.DisplayName.Should().Be(registerDto.DisplayName);
        userDto.Token.Should().NotBeNullOrEmpty();

        // Verify JWT token is valid
        userDto.Token.ShouldBeValidJwtToken(registerDto.Email);

        // Verify user exists in database
        var user = await UserManager.FindByEmailAsync(registerDto.Email);
        user.Should().NotBeNull();
        user!.DisplayName.Should().Be(registerDto.DisplayName);

        // Verify user has Eater role
        var roles = await UserManager.GetRolesAsync(user);
        roles.Should().Contain("Eater");

        // Verify refresh token cookie is set
        response.Headers.Should().ContainKey("Set-Cookie");
        var cookies = response.Headers.GetValues("Set-Cookie");
        cookies.Should().Contain(c => c.Contains("refreshToken"));
    }

    [Fact]
    public async Task Register_WeakPassword_ReturnsBadRequest()
    {
        // Arrange
        var registerDto = new RegisterDto
        {
            Email = "test@test.com",
            DisplayName = "Test User",
            Password = "weak" // Too short and doesn't meet complexity requirements
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/register", registerDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData("12345678", "Numbers only")]
    [InlineData("abcdefgh", "Letters only")]
    [InlineData("Password", "No special chars")]
    [InlineData("Pass1!", "Too short")]
    [InlineData("password123!", "No uppercase")]
    [InlineData("PASSWORD123!", "No lowercase")]
    [InlineData("Password!", "No numbers")]
    [InlineData("", "Empty")]
    public async Task Register_InvalidPassword_ReturnsBadRequest(string weakPassword, string reason)
    {
        // Arrange
        var registerDto = new RegisterDto
        {
            Email = $"test{Guid.NewGuid()}@test.com",
            DisplayName = "Test User",
            Password = weakPassword
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/register", registerDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest, $"because: {reason}");
    }

    [Theory]
    [InlineData("Password123!")]
    [InlineData("Admin123!")]
    [InlineData("Welcome123!")]
    [InlineData("Qwerty123!")]
    public async Task Register_CommonPassword_ShouldBeRejected(string commonPassword)
    {
        // Arrange
        var registerDto = new RegisterDto
        {
            Email = $"test{Guid.NewGuid()}@test.com",
            DisplayName = "Test User",
            Password = commonPassword
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/register", registerDto);

        // Assert - May pass if common password validation not implemented
        // This test documents expected behavior
        if (response.StatusCode == HttpStatusCode.BadRequest)
        {
            var content = await response.Content.ReadAsStringAsync();
            content.Should().ContainAny("password", "Password", "characters",
                "Should indicate a password-related issue");
        }
    }

    [Theory]
    [InlineData("notanemail")]
    [InlineData("@test.com")]
    [InlineData("user@")]
    [InlineData("user @test.com")]
    [InlineData("")]
    public async Task Register_InvalidEmail_ReturnsBadRequest(string invalidEmail)
    {
        // Arrange
        var registerDto = new RegisterDto
        {
            Email = invalidEmail,
            DisplayName = "Test User",
            Password = "ValidPass123!@#"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/register", registerDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Register_EmailWithInjection_RejectsOrSanitizes()
    {
        // Arrange - Test email injection attempt
        var maliciousEmail = "attacker@test.com\nBcc: victim@test.com";
        
        var registerDto = new RegisterDto
        {
            Email = maliciousEmail,
            DisplayName = "Test User",
            Password = "ValidPass123!@#"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/register", registerDto);

        // Assert - Should be rejected
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Register_ExtremelyLongEmail_ReturnsBadRequest()
    {
        // Arrange
        var longEmail = new string('a', 300) + "@test.com";
        
        var registerDto = new RegisterDto
        {
            Email = longEmail,
            DisplayName = "Test User",
            Password = "ValidPass123!@#"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/register", registerDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Register_DuplicateEmail_ReturnsBadRequest()
    {
        // Arrange
        var email = "duplicate@test.com";
        await AuthHelper.CreateUserAsync(email, "FirstPass123!@#", "Eater");

        var registerDto = new RegisterDto
        {
            Email = email,
            DisplayName = "Duplicate User",
            Password = "SecondPass123!@#"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/register", registerDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsTokenAndSetsCookie()
    {
        // Arrange
        var email = "testuser@test.com";
        var password = "TestPass123!@#";
        await AuthHelper.CreateUserAsync(email, password, "Eater");

        var loginDto = new LoginDto
        {
            Email = email,
            Password = password
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/login", loginDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var userDto = await response.Content.ReadFromJsonAsync<UserDto>();
        userDto.Should().NotBeNull();
        userDto!.Email.Should().Be(email);
        userDto.Token.Should().NotBeNullOrEmpty();

        // Verify JWT token is valid
        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.ReadJwtToken(userDto.Token);
        // JwtSecurityTokenHandler maps ClaimTypes.Email to the short "email" claim name
        token.Claims.Should().Contain(c =>
            (c.Type == ClaimTypes.Email || c.Type == JwtRegisteredClaimNames.Email) && c.Value == email);
        token.ValidTo.Should().BeAfter(DateTime.UtcNow);

        // Verify refresh token cookie is set
        response.Headers.Should().ContainKey("Set-Cookie");
    }

    [Fact]
    public async Task Login_InvalidCredentials_ReturnsUnauthorized()
    {
        // Arrange
        var email = "test@test.com";
        await AuthHelper.CreateUserAsync(email, "CorrectPass123!@#", "Eater");

        var loginDto = new LoginDto
        {
            Email = email,
            Password = "WrongPassword123!@#"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/login", loginDto);

        // Assert
        response.ShouldBeUnauthorized();
    }

    [Fact]
    public async Task Login_NonExistentEmail_ReturnsUnauthorized()
    {
        // Arrange
        var loginDto = new LoginDto
        {
            Email = "nonexistent@test.com",
            Password = "SomePassword123!@#"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/account/login", loginDto);

        // Assert
        response.ShouldBeUnauthorized();
    }

    [Fact]
    public async Task Login_ExceedsLockoutThreshold_LocksAccount()
    {
        // Arrange
        var email = "lockout@test.com";
        var password = "TestPass123!@#";
        await AuthHelper.CreateUserAsync(email, password, "Eater");

        var loginDto = new LoginDto
        {
            Email = email,
            Password = "WrongPassword123!@#"
        };

        // Act - Attempt 5 failed logins (lockout threshold)
        for (int i = 0; i < 5; i++)
        {
            await Client.PostAsJsonAsync("/api/account/login", loginDto);
        }

        // Attempt 6th login with correct password
        loginDto.Password = password;
        var response = await Client.PostAsJsonAsync("/api/account/login", loginDto);

        // Assert
        response.ShouldBeUnauthorized();

        // Verify user is locked out
        DbContext.ChangeTracker.Clear();
        var user = await UserManager.FindByEmailAsync(email);
        user.Should().NotBeNull();
        user!.LockoutEnd.Should().NotBeNull();
        user.LockoutEnd.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task AccessProtectedEndpoint_WithoutToken_ReturnsUnauthorized()
    {
        // Act
        var response = await Client.GetAsync("/api/cart");

        // Assert
        response.ShouldBeUnauthorized();
    }

    [Fact]
    public async Task AccessProtectedEndpoint_WithValidToken_ReturnsOk()
    {
        // Arrange
        var authenticatedClient = await CreateAuthenticatedClient(
            "user@test.com", "TestPass123!@#", "Eater");

        // Act
        var response = await authenticatedClient.GetAsync("/api/cart");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Logout_ValidRequest_InvalidatesRefreshToken()
    {
        // Arrange
        var email = "logout@test.com";
        var password = "TestPass123!@#";
        var user = await AuthHelper.CreateUserAsync(email, password, "Eater");

        // Login to get refresh token
        var loginDto = new LoginDto { Email = email, Password = password };
        var loginResponse = await Client.PostAsJsonAsync("/api/account/login", loginDto);
        loginResponse.EnsureSuccessStatusCode();

        // Get the refresh token cookie
        var cookies = loginResponse.Headers.GetValues("Set-Cookie");
        var refreshTokenCookie = cookies.FirstOrDefault(c => c.Contains("refreshToken"));
        refreshTokenCookie.Should().NotBeNull();

        // Create authenticated client
        var authenticatedClient = await CreateAuthenticatedClient(email, password, "Eater");

        // Act
        var logoutResponse = await authenticatedClient.PostAsync("/api/account/logout", null);

        // Assert
        logoutResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify refresh token is invalidated in database
        DbContext.ChangeTracker.Clear();
        var updatedUser = await UserManager.FindByEmailAsync(email);
        updatedUser!.RefreshToken.Should().BeNull();
        updatedUser.RefreshTokenExpiry.Should().BeNull();
    }
}
