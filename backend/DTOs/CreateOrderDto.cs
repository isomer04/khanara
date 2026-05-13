using System.ComponentModel.DataAnnotations;
using Khanara.API.Entities;

namespace Khanara.API.DTOs;

public class CreateOrderDto
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "CookProfileId must be a positive integer.")]
    public int CookProfileId { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "Order must contain at least one item.")]
    public List<CreateOrderItemDto> Items { get; set; } = [];

    [Required]
    [EnumDataType(typeof(FulfillmentType), ErrorMessage = "Invalid fulfillment type.")]
    public FulfillmentType FulfillmentType { get; set; }

    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;

    public DateTime? ScheduledFor { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
}

public class CreateOrderItemDto
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "DishId must be a positive integer.")]
    public int DishId { get; set; }

    [Required]
    [Range(1, 50, ErrorMessage = "Quantity must be between 1 and 50.")]
    public int Quantity { get; set; }
}
