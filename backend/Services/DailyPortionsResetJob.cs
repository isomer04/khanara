using Khanara.API.Data;
using Khanara.API.Entities;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Services;

/// <summary>
/// Resets every dish's PortionsRemainingToday back to PortionsPerBatch, minus
/// portions still held by active orders. Runs at most once per UTC day: a
/// second call the same day (scheduler retry, duplicate delivery, manual run)
/// is skipped. Timing is the caller's job: <see cref="DailyPortionsResetService"/>
/// in-process, or Cloud Scheduler through JobsController.
/// </summary>
public class DailyPortionsResetJob(
    AppDbContext context,
    ILogger<DailyPortionsResetJob> logger)
{
    private static readonly OrderStatus[] ActiveStatuses =
        [OrderStatus.Pending, OrderStatus.Accepted, OrderStatus.Preparing, OrderStatus.Ready];

    /// <returns>The number of dishes reset, or null if the reset already ran today.</returns>
    public async Task<int?> RunAsync(CancellationToken ct)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(ct);

        // Claim today's run. The row stays locked until commit, so a concurrent
        // call waits and then matches nothing; a failure rolls the claim back.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var claimed = await context.JobRuns
            .Where(j => j.Name == JobRun.DailyPortionsReset && (j.LastRunDateUtc == null || j.LastRunDateUtc < today))
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.LastRunDateUtc, today)
                .SetProperty(j => j.LastRunAt, DateTime.UtcNow), ct);

        if (claimed == 0)
        {
            logger.LogInformation("Daily portions reset already ran on {Date}; skipping", today);
            return null;
        }

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

        await transaction.CommitAsync(ct);

        logger.LogInformation(
            "Daily portions reset at {CutoverHour:D2}:00 UTC: {Count} dishes refreshed, " +
            "{Active} dish(es) had active-order deductions applied",
            DateTime.UtcNow.Hour, count, activeLocks.Count);

        return count;
    }
}
