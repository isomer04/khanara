using System.ComponentModel.DataAnnotations;

namespace Khanara.API.Entities;

public class Dish
{
    public int Id { get; set; }
    public int CookProfileId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public CuisineTag CuisineTag { get; set; }
    public DietaryTags DietaryTags { get; set; } = DietaryTags.None;
    public int PortionsPerBatch { get; set; }
    [ConcurrencyCheck]
    public int PortionsRemainingToday { get; set; }
    public bool IsAvailable { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public CookProfile CookProfile { get; set; } = null!;
    public ICollection<DishPhoto> Photos { get; set; } = [];
}
