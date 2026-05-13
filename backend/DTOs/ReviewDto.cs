namespace Khanara.API.DTOs;

public class ReviewDto
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public string AuthorDisplayName { get; set; } = string.Empty;
    public string? AuthorPhotoUrl { get; set; }
    public string? CookReply { get; set; }
    public DateTime? CookRepliedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
