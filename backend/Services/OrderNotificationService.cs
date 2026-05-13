using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.SignalR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Khanara.API.Services;

/// <summary>
/// Centralizes SignalR broadcast logic for order-related events.
/// Eliminates duplicate SendAsync calls between OrderHub and OrdersController.
/// </summary>
public class OrderNotificationService(IHubContext<OrderHub> hubContext, ILogger<OrderNotificationService> logger)
{
    public async Task BroadcastStatusChange(int orderId, OrderStatus oldStatus, OrderStatus newStatus, DateTime changedAt)
    {
        try
        {
            await hubContext.Clients.Group($"order-{orderId}").SendAsync("OrderStatusChanged", new OrderStatusChangedDto
            {
                OrderId = orderId,
                OldStatus = oldStatus.ToString(),
                NewStatus = newStatus.ToString(),
                ChangedAt = changedAt
            });
        }
        catch (Exception ex)
        {
            // Log but don't fail the request - the DB change already succeeded
            logger.LogError(ex, "Failed to broadcast order status change for order {OrderId} ({OldStatus} → {NewStatus})",
                orderId, oldStatus, newStatus);
        }
    }

    public async Task BroadcastMessage(int orderId, MessageDto message)
    {
        try
        {
            await hubContext.Clients.Group($"order-{orderId}")
                .SendAsync("OrderMessageReceived", new { orderId, message });
        }
        catch (Exception ex)
        {
            // Log but don't fail the request - the message is already saved
            logger.LogError(ex, "Failed to broadcast order message for order {OrderId}", orderId);
        }
    }
}
