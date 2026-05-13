using System.ComponentModel.DataAnnotations;
using Khanara.API.Entities;

namespace Khanara.API.DTOs;

public class UpdateDishDto
{
    [MaxLength(100)]
    public string? Name { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [Range(0.01, double.MaxValue, ErrorMessage = "Price must be greater than 0")]
    public decimal? Price { get; set; }

    public CuisineTag? CuisineTag { get; set; }
    public DietaryTags? DietaryTags { get; set; }

    [Range(1, int.MaxValue)]
    public int? PortionsPerBatch { get; set; }

    public int? PortionsRemainingToday { get; set; }
    public bool? IsAvailable { get; set; }
}
