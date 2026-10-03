using Khanara.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Khanara.API.Controllers;

/// <summary>
/// Entry points for Cloud Scheduler (see infra/terraform/prod/scheduler.tf).
/// Callers must present a Google-signed OIDC token issued to the configured
/// scheduler service account; see the "SchedulerJob" policy in Program.cs.
/// </summary>
[ApiController]
[Route("api/jobs")]
[Authorize(Policy = "SchedulerJob")]
[ApiExplorerSettings(IgnoreApi = true)]
public class JobsController(
    AbandonedOrderCleanupJob abandonedOrderCleanupJob,
    DailyPortionsResetJob dailyPortionsResetJob) : ControllerBase
{
    [HttpPost("abandoned-order-cleanup")]
    public async Task<IActionResult> CleanupAbandonedOrders(CancellationToken ct)
    {
        var cancelled = await abandonedOrderCleanupJob.RunAsync(ct);
        return Ok(new { cancelledOrders = cancelled });
    }

    [HttpPost("daily-portions-reset")]
    public async Task<IActionResult> ResetDailyPortions(CancellationToken ct)
    {
        var dishes = await dailyPortionsResetJob.RunAsync(ct);
        return Ok(new { dishesReset = dishes ?? 0, skipped = dishes is null });
    }
}
