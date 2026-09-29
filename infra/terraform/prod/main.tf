data "google_project" "this" {
  project_id = var.project_id
}

locals {
  site_url = "https://${var.domain}"

  # Where users actually reach the app: the domain once it is mapped, otherwise
  # the default run.app URL. That URL is deterministic, so building it here
  # avoids a dependency cycle between the service and its own URL.
  run_app_url = "https://${var.service_name}-${data.google_project.this.number}.${var.region}.run.app"
  public_url  = var.enable_domain_mapping ? local.site_url : local.run_app_url

  # Audience that Cloud Scheduler puts in its OIDC token and the API checks.
  # A fixed string (not the run.app URL) avoids a dependency cycle between
  # the service and its own URL.
  jobs_audience = "${local.site_url}/api/jobs"

  image_repo = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

resource "google_project_service" "apis" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudscheduler.googleapis.com",
    "dns.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
    "sts.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}
