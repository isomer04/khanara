# Cloud Scheduler replaces the API's in-process timers. Each job POSTs to an
# endpoint in JobsController with a Google-signed OIDC token; the API checks
# the audience and that the token belongs to the scheduler service account.
# Both jobs are safe to retry.

locals {
  scheduled_jobs = {
    "abandoned-order-cleanup" = {
      description = "Cancel unpaid Stripe orders older than 45 minutes and restore portions."
      schedule    = "*/15 * * * *"
    }
    "daily-portions-reset" = {
      description = "Reset every dish's remaining portions for the new day."
      schedule    = "0 ${var.daily_reset_hour_utc} * * *"
    }
  }
}

resource "google_cloud_scheduler_job" "jobs" {
  for_each = local.scheduled_jobs

  name             = "${var.service_name}-${each.key}"
  region           = var.region
  description      = each.value.description
  schedule         = each.value.schedule
  time_zone        = "Etc/UTC"
  attempt_deadline = "180s" # covers a cold start plus the job itself

  retry_config {
    retry_count          = 2
    min_backoff_duration = "30s"
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.app.uri}/api/jobs/${each.key}"

    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = local.jobs_audience
    }
  }

  depends_on = [google_project_service.apis]
}
