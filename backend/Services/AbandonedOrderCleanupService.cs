namespace Khanara.API.Services;

/// <summary>
/// Runs <see cref="AbandonedOrderCleanupJob"/> every 15 minutes in-process.
/// Registered only when "Jobs:RunInProcess" is true (the default). Hosts that
/// scale to zero, such as Cloud Run, trigger the job from Cloud Scheduler instead.
/// </summary>
public class AbandonedOrderCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<AbandonedOrderCleanupService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var job = scope.ServiceProvider.GetRequiredService<AbandonedOrderCleanupJob>();
                await job.RunAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during abandoned order cleanup");
            }
        }
    }
}
