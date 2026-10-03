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

        var candidates = await context.Orders
            .AsNoTracking()
            .Where(o => o.PaymentMethod == PaymentMethod.Stripe
                && o.PaymentStatus == PaymentStatus.Pending
                && o.Status == OrderStatus.Pending
                && o.CreatedAt < cutoff)
            .Select(o => new
            {
                o.Id,
                o.StripeSessionId,
                Items = o.Items.Select(i => new { i.DishId, i.Quantity }).ToList()
            })
            .ToListAsync(ct);

        if (candidates.Count == 0) return 0;

        var now = DateTime.UtcNow;
        var cancelled = new List<(int OrderId, string? SessionId)>();
        foreach (var order in candidates)
        {
            await using var transaction = await context.Database.BeginTransactionAsync(ct);

            // Cancel only if the order is still unpaid and pending. A payment webhook
            // that committed after the read above makes this match nothing, so a paid
            // order is never cancelled and its portions are never handed back.
            var updated = await context.Orders
                .Where(o => o.Id == order.Id
                    && o.PaymentStatus == PaymentStatus.Pending
                    && o.Status == OrderStatus.Pending)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.Status, OrderStatus.Cancelled)
                    .SetProperty(o => o.CancellationReason, "Payment not completed within the allowed time")
                    .SetProperty(o => o.UpdatedAt, now), ct);

            if (updated == 0) continue;

            foreach (var item in order.Items)
            {
                await context.Dishes
                    .Where(d => d.Id == item.DishId)
                    .ExecuteUpdateAsync(s => s.SetProperty(
                        d => d.PortionsRemainingToday,
                        d => d.PortionsRemainingToday + item.Quantity), ct);
            }

            await transaction.CommitAsync(ct);
            cancelled.Add((order.Id, order.StripeSessionId));
        }

        if (cancelled.Count == 0) return 0;

        logger.LogInformation(
            "Cancelled {Count} abandoned Stripe orders (older than {Minutes} min) and restored their dish portions",
            cancelled.Count, (int)AbandonedAfter.TotalMinutes);

        // Explicitly expire the Stripe Checkout Sessions so the payment URLs are dead.
        // This is best-effort — the DB cancellation above is already committed. If the
        // customer still pays, PaymentsController refunds the late payment.
        foreach (var (orderId, sessionId) in cancelled.Where(c => !string.IsNullOrEmpty(c.SessionId)))
        {
            try
            {
                await stripeService.ExpireCheckoutSessionAsync(sessionId!);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Failed to expire Stripe session {SessionId} for order {OrderId}",
                    sessionId, orderId);
            }
        }

        return cancelled.Count;
    }
}
