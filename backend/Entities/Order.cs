namespace Khanara.API.Entities;

public class Order
{
    public int Id { get; set; }
    public required string EaterUserId { get; set; }
    public int CookProfileId { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public FulfillmentType FulfillmentType { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime? ScheduledFor { get; set; }
    public string? Notes { get; set; }
    public string? CancellationReason { get; set; }
    public string? StripeSessionId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public string? StripeRefundId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public AppUser EaterUser { get; set; } = null!;
    public CookProfile CookProfile { get; set; } = null!;
    public ICollection<OrderItem> Items { get; set; } = [];
    public ICollection<Message> Messages { get; set; } = [];
}
