resource "google_project" "this" {
  count = var.create_project ? 1 : 0

  project_id      = var.project_id
  name            = var.project_name
  org_id          = var.org_id
  billing_account = var.billing_account

  # Cloud SQL is reached through Cloud Run's built-in connector, so the
  # default VPC is not needed.
  auto_create_network = false
  deletion_policy     = "PREVENT"

  lifecycle {
    precondition {
      condition     = var.org_id != null && var.billing_account != null
      error_message = "Set org_id and billing_account when create_project = true."
    }
  }
}

locals {
  project_id = var.create_project ? google_project.this[0].project_id : var.project_id
}

# APIs the prod stack needs before it can enable everything else itself.
resource "google_project_service" "base" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "cloudbilling.googleapis.com",
    "iam.googleapis.com",
    "storage.googleapis.com",
  ])

  project            = local.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "tfstate" {
  project  = local.project_id
  name     = "${local.project_id}-tfstate"
  location = upper(var.region)

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  # Keep the last 10 versions of each state file, drop older ones.
  lifecycle_rule {
    condition {
      num_newer_versions = 10
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.base]
}
