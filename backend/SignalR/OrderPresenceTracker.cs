using System.Collections.Concurrent;

namespace Khanara.API.SignalR;

public class OrderPresenceTracker
{
    // orderId → set of userIds currently viewing the order
    private static readonly ConcurrentDictionary<int, ConcurrentDictionary<string, byte>> OrderViewers = new();

    // connectionId → (orderId → userId) — enables cleanup when a connection drops unexpectedly
    private static readonly ConcurrentDictionary<string, ConcurrentDictionary<int, string>> ConnectionOrders = new();

    public void UserJoined(int orderId, string userId, string connectionId)
    {
        OrderViewers.GetOrAdd(orderId, _ => new ConcurrentDictionary<string, byte>())
                    .TryAdd(userId, 0);

        ConnectionOrders.GetOrAdd(connectionId, _ => new ConcurrentDictionary<int, string>())
                        .TryAdd(orderId, userId);
    }

    public void UserLeft(int orderId, string userId, string connectionId)
    {
        if (OrderViewers.TryGetValue(orderId, out var viewers))
        {
            viewers.TryRemove(userId, out _);
            if (viewers.IsEmpty) OrderViewers.TryRemove(orderId, out _);
        }

        if (ConnectionOrders.TryGetValue(connectionId, out var orders))
        {
            orders.TryRemove(orderId, out _);
            if (orders.IsEmpty) ConnectionOrders.TryRemove(connectionId, out _);
        }
    }

    /// <summary>
    /// Removes all order-presence entries for a connection that dropped without calling LeaveOrder.
    /// Returns the (orderId, userId) pairs that were cleaned up so callers can broadcast
    /// updated presence to the affected order groups.
    /// </summary>
    public IReadOnlyList<(int OrderId, string UserId)> RemoveConnection(string connectionId)
    {
        if (!ConnectionOrders.TryRemove(connectionId, out var orderMap))
            return [];

        var affected = new List<(int, string)>();
        foreach (var (orderId, userId) in orderMap)
        {
            if (OrderViewers.TryGetValue(orderId, out var viewers))
            {
                viewers.TryRemove(userId, out _);
                if (viewers.IsEmpty) OrderViewers.TryRemove(orderId, out _);
            }
            affected.Add((orderId, userId));
        }
        return affected;
    }

    public bool IsViewing(int orderId, string userId)
        => OrderViewers.TryGetValue(orderId, out var viewers) && viewers.ContainsKey(userId);
}
