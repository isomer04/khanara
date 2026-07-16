namespace Khanara.API.DTOs;

public class MemberDto
{
    public required string Id { get; set; }
    public required string DisplayName { get; set; }
    public string? ImageUrl { get; set; }
    public required string Email { get; set; }
}
