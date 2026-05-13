using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class SendOrderMessageDto
{
    [Required]
    [MaxLength(2000)]
    public required string Content { get; set; }
}
