using Khanara.API.Entities;

namespace Khanara.API.DTOs;

public class DishDto
{
    public int Id { get; set; }
    public int CookProfileId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public CuisineTag CuisineTag { get; set; }
    public DietaryTags DietaryTags { get; set; }
    public int PortionsPerBatch { get; set; }
    public int PortionsRemainingToday { get; set; }
    public bool IsAvailable { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<DishPhotoDto> Photos { get; set; } = [];
}
