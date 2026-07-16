using Khanara.API.Data;
using Khanara.API.Entities;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Services;

/// <summary>
/// Cancels Stripe orders whose payment was never completed.
/// Runs every 15 minutes and cancels orders older than 45 minutes.
/// Stripe Checkout Sessions expire after 24 hours on their own, but we cancel
/// earlier so portions are freed up for other customers the same day.
/// </summary>
public class AbandonedOrderCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<AbandonedOrderCleanupService> logger)
    : BackgroundService
{
    // How long to wait before considering a Stripe order abandoned.
    // Stripe sessions expire at 24 h; we cancel much earlier to free portions.
    private static readonly TimeSpan AbandonedAfter = TimeSpan.FromMinutes(45);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await CleanupAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during abandoned order cleanup");
            }
        }
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stripeService = scope.ServiceProvider.GetRequiredService<IStripeService>();

        var cutoff = DateTime.UtcNow - AbandonedAfter;

        var abandonedOrders = await context.Orders
            .Include(o => o.Items)
            .ThenInclude(i => i.Dish)
            .Where(o => o.PaymentMethod == PaymentMethod.Stripe
                && o.PaymentStatus == PaymentStatus.Pending
                && o.Status == OrderStatus.Pending
                && o.CreatedAt < cutoff)
            .ToListAsync(ct);

        if (abandonedOrders.Count == 0) return;

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
    }
}
