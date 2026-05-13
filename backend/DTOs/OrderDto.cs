using Khanara.API.Entities;

namespace Khanara.API.DTOs;

public class OrderDto
{
    public int Id { get; set; }
    public string EaterUserId { get; set; } = string.Empty;
    public string EaterDisplayName { get; set; } = string.Empty;
    public int CookProfileId { get; set; }
    public string CookKitchenName { get; set; } = string.Empty;
    public OrderStatus Status { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public FulfillmentType FulfillmentType { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime? ScheduledFor { get; set; }
    public string? Notes { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<OrderItemDto> Items { get; set; } = [];
}

public class OrderItemDto
{
    public int Id { get; set; }
    public int DishId { get; set; }
    public string DishName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPriceSnapshot { get; set; }
}
