namespace Khanara.API.DTOs;

public class MessageDto
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public required string SenderId { get; set; }
    public required string SenderDisplayName { get; set; }
    public required string Content { get; set; }
    public DateTime SentAt { get; set; }
}
