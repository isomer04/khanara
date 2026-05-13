using System.ComponentModel.DataAnnotations;

namespace Khanara.API.Entities;

public class CartItem
{
    public int Id { get; set; }

    [Required]
    public required string UserId { get; set; }
    public AppUser User { get; set; } = null!;

    [Required]
    public int DishId { get; set; }
    public Dish Dish { get; set; } = null!;

    [Required]
    [Range(1, 100)]
    public int Quantity { get; set; }

    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    [ConcurrencyCheck]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
