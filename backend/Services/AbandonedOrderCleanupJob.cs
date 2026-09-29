using Khanara.API.Data;
using Khanara.API.Entities;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Services;

/// <summary>
/// Cancels Stripe orders whose payment was never completed and restores their portions.
/// Stripe Checkout Sessions expire after 24 hours on their own, but we cancel
/// earlier so portions are freed up for other customers the same day.
/// Safe to run repeatedly: already-cancelled orders no longer match.
/// Triggered by <see cref="AbandonedOrderCleanupService"/> (in-process timer) or by
/// Cloud Scheduler through JobsController.
/// </summary>
public class AbandonedOrderCleanupJob(
    AppDbContext context,
    IStripeService stripeService,
    ILogger<AbandonedOrderCleanupJob> logger)
{
    // How long to wait before considering a Stripe order abandoned.
    // Stripe sessions expire at 24 h; we cancel much earlier to free portions.
    public static readonly TimeSpan AbandonedAfter = TimeSpan.FromMinutes(45);

    /// <returns>The number of orders cancelled.</returns>
    public async Task<int> RunAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow - AbandonedAfter;

        var abandonedOrders = await context.Orders
            .Include(o => o.Items)
            .ThenInclude(i => i.Dish)
            .Where(o => o.PaymentMethod == PaymentMethod.Stripe
                && o.PaymentStatus == PaymentStatus.Pending
                && o.Status == OrderStatus.Pending
                && o.CreatedAt < cutoff)
            .ToListAsync(ct);

        if (abandonedOrders.Count == 0) return 0;

        var now = DateTime.UtcNow;
        foreach (var order in abandonedOrders)
        {
            order.Status = OrderStatus.Cancelled;
            order.CancellationReason = "Payment not completed within the allowed time";
            order.UpdatedAt = now;

            foreach (var item in order.Items)
            {
                if (item.Dish != null)
                    item.Dish.PortionsRemainingToday += item.Quantity;
            }
        }

        await context.SaveChangesAsync(ct);
        logger.LogInformation(
            "Cancelled {Count} abandoned Stripe orders (older than {Minutes} min) and restored their dish portions",
            abandonedOrders.Count, (int)AbandonedAfter.TotalMinutes);

        // Explicitly expire the Stripe Checkout Sessions so the payment URLs are dead.
        // This is best-effort — the DB cancellation above is already committed.
        foreach (var order in abandonedOrders.Where(o => !string.IsNullOrEmpty(o.StripeSessionId)))
        {
            try
            {
                await stripeService.ExpireCheckoutSessionAsync(order.StripeSessionId!);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to expire Stripe session {SessionId} for order {OrderId}",
                    order.StripeSessionId, order.Id);
            }
        }

        return abandonedOrders.Count;
    }
}
