using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class AddCartItemDto
{
    [Required]
    public int DishId { get; set; }

    [Required]
    [Range(1, 100)]
    public int Quantity { get; set; }
}
