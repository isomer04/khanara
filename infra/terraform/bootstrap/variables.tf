variable "project_id" {
  description = "Globally unique GCP project ID to create (or adopt when create_project = false)."
  type        = string
}

variable "project_name" {
  description = "Human-readable project name."
  type        = string
  default     = "Khanara"
}

variable "create_project" {
  description = "Create the project here. The runbook creates it with gcloud instead (a brand-new project can't yet serve as the quota project for these API calls), so this defaults to false."
  type        = bool
  default     = false
}

variable "org_id" {
  description = "Numeric organization ID of the khanara.shop Cloud Identity org (gcloud organizations list). Only needed when create_project = true."
  type        = string
  default     = null
}

variable "billing_account" {
  description = "Billing account ID that holds the free-trial credit (gcloud billing accounts list). Only needed when create_project = true."
  type        = string
  default     = null
}

variable "region" {
  description = "Default region. Also used as the state bucket location."
  type        = string
  default     = "us-central1"
}
