using System.Security.Cryptography;
using System.Text;
using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Extensions;
using Khanara.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace Khanara.API.Controllers;

[EnableRateLimiting("auth")]
public class AccountController(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    ITokenService tokenService,
    ILogger<AccountController> logger) : BaseApiController
{
    // Pre-compiled delegates — arguments are never evaluated when the log level is
    // disabled, satisfying CA1848 without requiring a source generator.
    private static readonly Action<ILogger, string, Exception?> LogEmailNotFound =
        LoggerMessage.Define<string>(LogLevel.Warning, new EventId(1, "EmailNotFound"),
            "Failed login: email not found from {IP}");

    private static readonly Action<ILogger, string, Exception?> LogAccountLockedOut =
        LoggerMessage.Define<string>(LogLevel.Warning, new EventId(2, "AccountLockedOut"),
            "Failed login: account {UserId} is locked out");

    private static readonly Action<ILogger, string, string, Exception?> LogWrongPassword =
        LoggerMessage.Define<string, string>(LogLevel.Warning, new EventId(3, "WrongPassword"),
            "Failed login: wrong password for user {UserId} from {IP}");

    private static readonly Action<ILogger, string, string, Exception?> LogLoginSuccess =
        LoggerMessage.Define<string, string>(LogLevel.Information, new EventId(4, "LoginSuccess"),
            "User {UserId} logged in from {IP}");

    [HttpPost("register")]
    public async Task<ActionResult<UserDto>> Register(RegisterDto registerDto)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid().ToString(),
            DisplayName = registerDto.DisplayName,
            Email = registerDto.Email,
            UserName = registerDto.Email
        };

        var result = await userManager.CreateAsync(user, registerDto.Password);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
                ModelState.AddModelError("identity", error.Description);
            return ValidationProblem();
        }

        await userManager.AddToRoleAsync(user, "Eater");
        await SetRefreshTokenCookie(user);
        return await user.ToDto(tokenService);
    }

    [HttpPost("login")]
    public async Task<ActionResult<UserDto>> Login(LoginDto loginDto)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        var user = await userManager.FindByEmailAsync(loginDto.Email);
        if (user == null)
        {
            LogEmailNotFound(logger, ip, null);
            return Unauthorized("Invalid credentials");
        }

        // lockoutOnFailure: true — SignInManager increments AccessFailedCount,
        // checks the lockout threshold, and sets LockoutEnd atomically.
        // This is the only correct way to activate ASP.NET Identity's lockout;
        // UserManager.CheckPasswordAsync does not touch the lockout counters.
        var result = await signInManager.CheckPasswordSignInAsync(user, loginDto.Password, lockoutOnFailure: true);

        if (result.IsLockedOut)
        {
            LogAccountLockedOut(logger, user.Id, null);
            return Unauthorized("Invalid credentials");
        }

        if (!result.Succeeded)
        {
            LogWrongPassword(logger, user.Id, ip, null);
            return Unauthorized("Invalid credentials");
        }

        LogLoginSuccess(logger, user.Id, ip, null);
        await SetRefreshTokenCookie(user);
        return await user.ToDto(tokenService);
    }

    [HttpPost("refresh-token")]
    public async Task<ActionResult<UserDto>> RefreshToken()
    {
        var rawToken = Request.Cookies["refreshToken"];
        if (rawToken == null) return Unauthorized();

        var tokenHash = HashToken(rawToken);

        var user = await userManager.Users
            .FirstOrDefaultAsync(x => x.RefreshToken == tokenHash
                && x.RefreshTokenExpiry > DateTime.UtcNow);

        if (user == null) return Unauthorized();

        await SetRefreshTokenCookie(user);
        return await user.ToDto(tokenService);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<ActionResult> Logout()
    {
        await userManager.Users
            .Where(x => x.Id == User.GetMemberId())
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.RefreshToken, _ => null)
                .SetProperty(x => x.RefreshTokenExpiry, _ => null));

        Response.Cookies.Delete("refreshToken");
        return Ok();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private async Task SetRefreshTokenCookie(AppUser user)
    {
        var rawToken = tokenService.GenerateRefreshToken();
        user.RefreshToken = HashToken(rawToken);
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(60);
        await userManager.UpdateAsync(user);

        Response.Cookies.Append("refreshToken", rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddDays(60)
        });
    }

    private static string HashToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
