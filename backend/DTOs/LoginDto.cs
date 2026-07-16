using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class LoginDto
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = "";

    [Required]
    [MaxLength(100)]
    public string Password { get; set; } = "";
}
