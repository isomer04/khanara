using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class UpdateMemberDto
{
    [Required]
    [MaxLength(50)]
    public required string DisplayName { get; set; }
}
