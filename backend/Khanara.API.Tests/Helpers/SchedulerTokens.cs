using System.Security.Cryptography;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Khanara.API.Tests.Helpers;

/// <summary>
/// Stands in for Google when testing the Cloud Scheduler endpoints. Tokens are
/// signed with a local RSA key that CustomWebApplicationFactory installs as the
/// "SchedulerOidc" scheme's signing key, so no request ever reaches Google.
/// Audience and email match appsettings.Test.json.
/// </summary>
public static class SchedulerTokens
{
    public const string Audience = "https://test.khanara.com/api/jobs";
    public const string SchedulerEmail = "scheduler@test-project.iam.gserviceaccount.com";
    public const string GoogleIssuer = "https://accounts.google.com";

    public static readonly RsaSecurityKey SigningKey = new(RSA.Create(2048)) { KeyId = "test-scheduler-key" };

    public static string Create(
        string email = SchedulerEmail,
        string audience = Audience,
        bool emailVerified = true)
    {
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = GoogleIssuer,
            Audience = audience,
            Expires = DateTime.UtcNow.AddMinutes(5),
            Claims = new Dictionary<string, object>
            {
                ["email"] = email,
                ["email_verified"] = emailVerified
            },
            SigningCredentials = new SigningCredentials(SigningKey, SecurityAlgorithms.RsaSha256)
        });
    }
}
