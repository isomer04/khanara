namespace Khanara.API.Entities;

/// <summary>
/// Bookkeeping for scheduled jobs that must run at most once per UTC day,
/// even when the scheduler retries or delivers a trigger twice.
/// </summary>
public class JobRun
{
    public const string DailyPortionsReset = "daily-portions-reset";

    public required string Name { get; set; }
    public DateOnly? LastRunDateUtc { get; set; }
    public DateTime? LastRunAt { get; set; }
}
