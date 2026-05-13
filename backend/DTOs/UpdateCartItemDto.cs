using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class UpdateCartItemDto
{
    [Required]
    [Range(1, 100)]
    public int Quantity { get; set; }
}
