namespace Khanara.API.DTOs;

public class FavoriteDto
{
    public int CookProfileId { get; set; }
    public string KitchenName { get; set; } = string.Empty;
    public string? KitchenPhotoUrl { get; set; }
    public decimal AverageRating { get; set; }
    public int ReviewCount { get; set; }
    public bool IsAcceptingOrders { get; set; }
    public DateTime FavoritedAt { get; set; }
}
