namespace Khanara.API.Entities;

public class Favorite
{
    public required string EaterUserId { get; set; }
    public int CookProfileId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AppUser EaterUser { get; set; } = null!;
    public CookProfile CookProfile { get; set; } = null!;
}
