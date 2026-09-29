variable "project_id" {
  description = "Project created by ../bootstrap."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Cloud SQL, Artifact Registry and Cloud Scheduler. Must support Cloud Run domain mappings."
  type        = string
  default     = "us-central1"
}

variable "billing_account" {
  description = "Billing account ID, used only for the budget alert."
  type        = string
}

variable "domain" {
  description = "Apex domain served by the app. www.<domain> is mapped too."
  type        = string
  default     = "khanara.shop"
}

variable "github_repository" {
  description = "owner/repo allowed to deploy through Workload Identity Federation."
  type        = string
  default     = "isomer04/khanara"
}

variable "service_name" {
  description = "Cloud Run service name. Also used for the Artifact Registry repo and image."
  type        = string
  default     = "khanara"
}

variable "initial_image" {
  description = "Placeholder image for the first apply. CI replaces it; Terraform ignores image changes afterwards."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "cloudinary_cloud_name" {
  description = "Cloudinary cloud name (not a secret)."
  type        = string
}

# ── Database ──────────────────────────────────────────────────────────────────

variable "db_tier" {
  description = "Cloud SQL machine tier. db-f1-micro is shared-core (~$8/month, 25 max connections)."
  type        = string
  default     = "db-f1-micro"
}

variable "db_version" {
  description = "Cloud SQL PostgreSQL major version."
  type        = string
  default     = "POSTGRES_17"
}

variable "db_password_version" {
  description = "Bump to generate a new database password and connection-string secret version."
  type        = number
  default     = 1
}

variable "token_key_version" {
  description = "Bump to generate a new JWT signing key (logs every user out)."
  type        = number
  default     = 1
}

# ── Scheduled jobs ────────────────────────────────────────────────────────────

variable "daily_reset_hour_utc" {
  description = "UTC hour (0-23) at which dish portions are reset each day."
  type        = number
  default     = 3

  validation {
    condition     = var.daily_reset_hour_utc >= 0 && var.daily_reset_hour_utc <= 23
    error_message = "daily_reset_hour_utc must be between 0 and 23."
  }
}

# ── DNS ───────────────────────────────────────────────────────────────────────

variable "apex_txt_records" {
  description = "Existing TXT records on the apex to keep after moving DNS to Cloud DNS, e.g. the google-site-verification value used by Cloud Identity."
  type        = list(string)
  default     = []
}

variable "mx_records" {
  description = "Existing MX records on the apex (\"<priority> <host>.\"). Leave empty if the domain receives no mail."
  type        = list(string)
  default     = []
}

# ── Budget ────────────────────────────────────────────────────────────────────

variable "monthly_budget_usd" {
  description = "Monthly budget for alert emails. Counts spend before credits, so alerts fire even while the trial credit pays."
  type        = number
  default     = 25
}

variable "budget_currency_code" {
  description = "Currency of the billing account (the budget API rejects a mismatch)."
  type        = string
  default     = "USD"
}
