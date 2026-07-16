using Khanara.API.Data;
using Khanara.API.Entities;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Services;

/// <summary>
/// Resets every dish's PortionsRemainingToday back to PortionsPerBatch once a day
/// at the configured platform cutover time (default: 03:00 UTC).
///
/// Configure via appsettings: "DailyReset:CutoverHourUtc" (integer 0–23, default 3).
/// </summary>
public class DailyPortionsResetService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<DailyPortionsResetService> logger)
    : BackgroundService
{
    private static readonly OrderStatus[] ActiveStatuses =
        [OrderStatus.Pending, OrderStatus.Accepted, OrderStatus.Preparing, OrderStatus.Ready];

    private DateOnly _lastResetDate = DateOnly.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Read once at startup; restart required to pick up config changes (intentional).
        var cutoverHour = configuration.GetValue("DailyReset:CutoverHourUtc", 3);
        if (cutoverHour is < 0 or > 23)
        {
            logger.LogWarning(
                "DailyReset:CutoverHourUtc value {Hour} is out of range (0–23); defaulting to 3",
                cutoverHour);
            cutoverHour = 3;
        }

        logger.LogInformation(
            "DailyPortionsResetService will run at {Hour:D2}:00 UTC each day", cutoverHour);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var now = DateTime.UtcNow;
            var today = DateOnly.FromDateTime(now);

            // Fire once per day during the configured cutover hour (e.g. 03:00–03:29 UTC)
            if (now.Hour == cutoverHour && today > _lastResetDate)
            {
                _lastResetDate = today;
                try
                {
                    await ResetPortionsAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error during daily portions reset");
                    _lastResetDate = DateOnly.MinValue; // allow retry on next tick
                }
            }
        }
    }

    private async Task ResetPortionsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Step 1: Restore every dish to its full daily batch.
        var count = await context.Dishes
            .ExecuteUpdateAsync(
                s => s.SetProperty(d => d.PortionsRemainingToday, d => d.PortionsPerBatch),
                ct);

        // Step 2: Deduct portions still locked by orders that crossed the cutover
        // (Pending / Accepted / Preparing / Ready — not yet Delivered or Cancelled).
        // Without this, resetting a dish that has an active overnight order makes
        // those portions appear available again for new orders on the new day.
        var activeLocks = await context.OrderItems
            .Where(oi => ActiveStatuses.Contains(oi.Order.Status))
            .GroupBy(oi => oi.DishId)
            .Select(g => new { DishId = g.Key, Locked = g.Sum(oi => oi.Quantity) })
            .ToListAsync(ct);

        foreach (var entry in activeLocks)
        {
            await context.Dishes
                .Where(d => d.Id == entry.DishId)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(
                        d => d.PortionsRemainingToday,
                        d => d.PortionsRemainingToday - entry.Locked > 0
                            ? d.PortionsRemainingToday - entry.Locked
                            : 0),
                    ct);
        }

        logger.LogInformation(
            "Daily portions reset at {CutoverHour:D2}:00 UTC: {Count} dishes refreshed, " +
            "{Active} dish(es) had active-order deductions applied",
            DateTime.UtcNow.Hour, count, activeLocks.Count);
    }
}
