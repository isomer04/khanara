using Khanara.API.Extensions;
using Khanara.API.Interfaces;
using Khanara.API.DTOs;
using Khanara.API.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Khanara.API.SignalR;

/// <summary>
/// Handles real-time presence and order-group membership.
///
/// Message sending is intentionally NOT implemented here.
/// Use POST /api/orders/{id}/messages (REST) to send a message.
/// The REST endpoint persists the message and then calls OrderNotificationService
/// to broadcast it to all hub clients in the order group — keeping a single
/// write path that is easier to test, audit, and rate-limit.
/// </summary>
[Authorize]
public class OrderHub(IUnitOfWork uow, OrderPresenceTracker presenceTracker) : Hub
{
    public async Task JoinOrder(int orderId)
    {
        var userId = GetUserId();
        var order = await uow.OrderRepository.GetOrderByIdAsync(orderId)
            ?? throw new HubException("Order not found");

        if (!IsParticipant(order, userId))
            throw new HubException("Not authorised to join this order");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(orderId));
        presenceTracker.UserJoined(orderId, userId, Context.ConnectionId);

        await Clients.Group(GroupName(orderId))
            .SendAsync("OrderPresence", BuildPresence(order, orderId));
    }

    public async Task LeaveOrder(int orderId)
    {
        var userId = GetUserId();
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(orderId));
        presenceTracker.UserLeft(orderId, userId, Context.ConnectionId);

        var order = await uow.OrderRepository.GetOrderByIdAsync(orderId);
        if (order != null)
            await Clients.Group(GroupName(orderId))
                .SendAsync("OrderPresence", BuildPresence(order, orderId));
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Clean up presence for every order this connection was viewing.
        // If the client called LeaveOrder before disconnecting the list is empty and
        // this is a no-op. If the connection dropped unexpectedly (browser crash, tab
        // close) presence stays accurate without relying on the client calling LeaveOrder.
        var affected = presenceTracker.RemoveConnection(Context.ConnectionId);
        foreach (var (orderId, _) in affected)
        {
            var order = await uow.OrderRepository.GetOrderByIdAsync(orderId);
            if (order != null)
                await Clients.Group(GroupName(orderId))
                    .SendAsync("OrderPresence", BuildPresence(order, orderId));
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static string GroupName(int orderId) => $"order-{orderId}";

    private static bool IsParticipant(Order order, string userId)
        => order.EaterUserId == userId || order.CookProfile?.AppUserId == userId;

    private OrderPresenceDto BuildPresence(Order order, int orderId) => new()
    {
        OrderId = orderId,
        EaterOnline = presenceTracker.IsViewing(orderId, order.EaterUserId),
        CookOnline = order.CookProfile?.AppUserId is string cookId
            && presenceTracker.IsViewing(orderId, cookId)
    };

    private string GetUserId()
        => Context.User?.GetMemberId() ?? throw new HubException("Cannot resolve user");
}
