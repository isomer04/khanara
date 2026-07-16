using System.ComponentModel.DataAnnotations;
using Khanara.API.Entities;

namespace Khanara.API.DTOs;

public class CreateCookProfileDto
{
    [Required, MaxLength(100)]
    public required string KitchenName { get; set; }

    [MaxLength(1000)]
    public string? Bio { get; set; }

    [MinLength(1, ErrorMessage = "At least one cuisine tag is required")]
    public List<CuisineTag> CuisineTags { get; set; } = [];

    public List<string> ServiceZipCodes { get; set; } = [];
}
