terraform {
  # 1.11+ for write-only arguments (secrets never land in state).
  required_version = ">= 1.11"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }

  # Partial config: terraform init -backend-config=backend.hcl
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region

  # Billing budgets and some other APIs need a quota project when
  # authenticating with user credentials.
  user_project_override = true
  billing_project       = var.project_id
}
