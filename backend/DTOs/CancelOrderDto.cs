using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class CancelOrderDto
{
    [Required]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}
