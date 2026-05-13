using Microsoft.AspNetCore.Identity;

namespace Khanara.API.Entities;

public class AppUser : IdentityUser
{
    public required string DisplayName { get; set; }
    public string? ImageUrl { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
    public CookProfile? CookProfile { get; set; }
}
