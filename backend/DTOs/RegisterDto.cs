using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class RegisterDto
{
    [Required]
    [MaxLength(50)]
    public string DisplayName { get; set; } = "";

    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = "";

    [Required]
    [MinLength(12)]
    [MaxLength(100)]
    public string Password { get; set; } = "";
}
