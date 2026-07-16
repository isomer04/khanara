using System.ComponentModel.DataAnnotations;
using Khanara.API.Entities;

namespace Khanara.API.DTOs;

public class UpdateCookProfileDto
{
    [MaxLength(100)]
    public string? KitchenName { get; set; }

    [MaxLength(1000)]
    public string? Bio { get; set; }

    public List<CuisineTag>? CuisineTags { get; set; }
    public List<string>? ServiceZipCodes { get; set; }
    public bool? IsAcceptingOrders { get; set; }
}
