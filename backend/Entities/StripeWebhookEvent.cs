namespace Khanara.API.Entities;

public class StripeWebhookEvent
{
    public int Id { get; set; }
    public string StripeEventId { get; set; } = string.Empty;
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
