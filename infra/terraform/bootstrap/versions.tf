terraform {
  required_version = ">= 1.11"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.4"
    }
  }

  # Local state on purpose: this stack creates the bucket that holds the
  # remote state for ../prod. Keep terraform.tfstate out of git (see
  # ../.gitignore) and back it up somewhere safe.
}

# No billing_project/user_project_override here: the project may not exist
# yet, so it cannot be used as the quota project for these calls.
provider "google" {
  region = var.region
}
