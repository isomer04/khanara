using Khanara.API.Entities;

namespace Khanara.API.DTOs;

public class CookProfileDto
{
    public int Id { get; set; }
    public required string AppUserId { get; set; }
    public required string KitchenName { get; set; }
    public string? Bio { get; set; }
    public List<CuisineTag> CuisineTags { get; set; } = [];
    public List<string> ServiceZipCodes { get; set; } = [];
    public string? KitchenPhotoUrl { get; set; }
    public bool IsAcceptingOrders { get; set; }
    public decimal AverageRating { get; set; }
    public int ReviewCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string OwnerDisplayName { get; set; } = string.Empty;
    public List<DishDto> Dishes { get; set; } = [];
}
