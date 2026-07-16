using Khanara.API.Entities;

namespace Khanara.API.DTOs;

public class DiscoveryCookDto
{
    public int Id { get; set; }
    public string KitchenName { get; set; } = string.Empty;
    public string? KitchenPhotoUrl { get; set; }
    public decimal AverageRating { get; set; }
    public int ReviewCount { get; set; }
    public bool IsAcceptingOrders { get; set; }
    public List<CuisineTag> CuisineTags { get; set; } = [];
    public List<string> ServiceZipCodes { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}
