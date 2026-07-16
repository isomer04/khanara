namespace Khanara.API.Entities;

public class CookProfile
{
    public int Id { get; set; }
    public required string AppUserId { get; set; }
    public required string KitchenName { get; set; }
    public string? Bio { get; set; }
    public List<CuisineTag> CuisineTags { get; set; } = [];
    public List<string> ServiceZipCodes { get; set; } = [];
    public string? KitchenPhotoUrl { get; set; }
    public bool IsAcceptingOrders { get; set; } = true;
    public decimal AverageRating { get; set; } = 0;
    public int ReviewCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public AppUser AppUser { get; set; } = null!;
    public ICollection<Dish> Dishes { get; set; } = [];
}
