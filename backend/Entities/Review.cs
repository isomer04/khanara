using System.ComponentModel.DataAnnotations;

namespace Khanara.API.Entities;

public class Review
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int Rating { get; set; }
    [MaxLength(1000)]
    public string? Comment { get; set; }
    public required string AuthorUserId { get; set; }
    [MaxLength(1000)]
    public string? CookReply { get; set; }
    public DateTime? CookRepliedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Order Order { get; set; } = null!;
    public AppUser Author { get; set; } = null!;
}
