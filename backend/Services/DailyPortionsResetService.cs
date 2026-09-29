namespace Khanara.API.Services;

/// <summary>
/// Runs <see cref="DailyPortionsResetJob"/> once a day at the configured platform
/// cutover time (default: 03:00 UTC), checking every 30 minutes in-process.
/// Registered only when "Jobs:RunInProcess" is true (the default). Hosts that
/// scale to zero, such as Cloud Run, trigger the job from Cloud Scheduler instead.
///
/// Configure via appsettings: "DailyReset:CutoverHourUtc" (integer 0–23, default 3).
/// </summary>
public class DailyPortionsResetService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<DailyPortionsResetService> logger)
    : BackgroundService
{
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
                    using var scope = scopeFactory.CreateScope();
                    var job = scope.ServiceProvider.GetRequiredService<DailyPortionsResetJob>();
                    await job.RunAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error during daily portions reset");
                    _lastResetDate = DateOnly.MinValue; // allow retry on next tick
                }
            }
        }
    }
}
