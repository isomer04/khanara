using Khanara.API.Entities;

namespace Khanara.API.DTOs;

public class UpdateOrderStatusDto
{
    public OrderStatus NewStatus { get; set; }
}
