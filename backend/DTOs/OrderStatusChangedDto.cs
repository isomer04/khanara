namespace Khanara.API.DTOs;

public class OrderStatusChangedDto
{
    public int OrderId { get; set; }
    public required string OldStatus { get; set; }
    public required string NewStatus { get; set; }
    public DateTime ChangedAt { get; set; }
}
