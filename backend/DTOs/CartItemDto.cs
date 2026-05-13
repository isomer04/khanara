namespace Khanara.API.DTOs;

public class CartItemDto
{
    public int Id { get; set; }
    public int DishId { get; set; }
    public string DishName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public string? PhotoUrl { get; set; }
    public int CookProfileId { get; set; }
    public DateTime AddedAt { get; set; }
}
