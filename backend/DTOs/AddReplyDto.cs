using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class AddReplyDto
{
    [Required]
    [MaxLength(1000)]
    public required string Reply { get; set; }
}
