using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class MergeCartDto
{
    [Required]
    public List<AddCartItemDto> Items { get; set; } = [];
}
