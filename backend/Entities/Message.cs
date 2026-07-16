namespace Khanara.API.Entities;

public class Message
{
    public int Id { get; set; }
    public required string Content { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    public required string SenderId { get; set; }
    public AppUser Sender { get; set; } = null!;

    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
}
