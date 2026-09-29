locals {
  app_env = {
    ASPNETCORE_ENVIRONMENT = "Production"
    # Trust X-Forwarded-For/Proto from Cloud Run's front end so the auth rate
    # limiter sees real client IPs and HTTPS redirection/HSTS work.
    ASPNETCORE_FORWARDEDHEADERS_ENABLED = "true"
    # Cloud Run only routes requests for its own hostnames; health probes
    # arrive with the container IP as Host.
    AllowedHosts = "*"

    Jwt__Issuer             = local.site_url
    Jwt__Audience           = local.site_url
    Cors__AllowedOrigins__0 = local.site_url
    Cors__AllowedOrigins__1 = "https://www.${var.domain}"

    CloudinarySettings__CloudName = var.cloudinary_cloud_name
    Stripe__SuccessUrl            = "${local.site_url}/payment/success?orderId={0}"
    Stripe__CancelUrl             = "${local.site_url}/orders/{0}"

    # Background jobs are triggered by Cloud Scheduler (scheduler.tf), not
    # in-process timers, because the instance scales to zero.
    Jobs__RunInProcess                 = "false"
    DailyReset__CutoverHourUtc         = tostring(var.daily_reset_hour_utc)
    Jobs__OidcAudience                 = local.jobs_audience
    Jobs__SchedulerServiceAccountEmail = google_service_account.scheduler.email
  }
}

resource "google_cloud_run_v2_service" "app" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  # Public site. The org's domain-restricted-sharing policy blocks granting
  # run.invoker to allUsers, so turn off the invoker check instead.
  invoker_iam_disabled = true

  # Stateless; the database has its own deletion protection.
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email

    # SignalR keeps order presence in memory and has no backplane, so all
    # clients must hit the same instance. Scale to zero when idle.
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    # Each open SignalR WebSocket holds a slot on the single instance.
    max_instance_request_concurrency = 250
    session_affinity                 = true
    timeout                          = "3600s" # long-lived SignalR WebSockets

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.initial_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true # request-based billing
        startup_cpu_boost = true
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      # TCP rather than /healthz so the placeholder image also passes.
      # Migrations run before Kestrel listens, so allow up to 4 minutes.
      startup_probe {
        tcp_socket {
          port = 8080
        }
        period_seconds    = 10
        timeout_seconds   = 5
        failure_threshold = 24
      }

      dynamic "env" {
        for_each = local.app_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.key].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    # CI (deploy-gcp.yml) owns the image; Terraform owns everything else.
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
      template[0].revision,
      template[0].labels,
      template[0].annotations,
    ]
  }

  depends_on = [
    google_project_iam_member.runtime_cloudsql,
    google_secret_manager_secret_iam_member.runtime,
    google_secret_manager_secret_version.placeholder,
    google_secret_manager_secret_version.jwt_token_key,
    google_secret_manager_secret_version.db_connection_string,
  ]
}
