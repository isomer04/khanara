locals {
  # Secret Manager secret suffix -> environment variable the API reads.
  secret_env = {
    "db-connection-string"  = "ConnectionStrings__DefaultConnection"
    "jwt-token-key"         = "TokenKey"
    "cloudinary-api-key"    = "CloudinarySettings__ApiKey"
    "cloudinary-api-secret" = "CloudinarySettings__ApiSecret"
    "stripe-secret-key"     = "Stripe__SecretKey"
    "stripe-webhook-secret" = "Stripe__WebhookSecret"
  }

  # Third-party credentials: Terraform only creates a placeholder version so
  # the first deploy can start. Add the real values with
  #   gcloud secrets versions add khanara-<name> --data-file=-
  # Cloud Run reads the "latest" version, so they take over on the next start.
  manual_secrets = toset([
    "cloudinary-api-key",
    "cloudinary-api-secret",
    "stripe-secret-key",
    "stripe-webhook-secret",
  ])

  # A literal, not google_sql_user.app.name: the user's password version is
  # derived from this prefix.
  db_user = "khanara_app"

  # Keep the pool well below db-f1-micro's 25-connection limit.
  db_connection_prefix = join(";", [
    "Host=/cloudsql/${google_sql_database_instance.main.connection_name}",
    "Database=${google_sql_database.app.name}",
    "Username=${local.db_user}",
    "Maximum Pool Size=10",
  ])

  # The password is ephemeral (a new value on every run), so the secret can only
  # be rewritten in the same apply that sets the password on the Cloud SQL user.
  # Both use this version, which also changes with the prefix, so editing the
  # prefix rotates the password instead of never reaching Secret Manager.
  db_credentials_version = parseint(substr(sha256("${var.db_password_version}:${local.db_connection_prefix}"), 0, 8), 16)
}

resource "google_secret_manager_secret" "app" {
  for_each = local.secret_env

  secret_id = "${var.service_name}-${each.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "placeholder" {
  for_each = local.manual_secrets

  secret                 = google_secret_manager_secret.app[each.key].id
  secret_data_wo         = "REPLACE_ME"
  secret_data_wo_version = 1
}

ephemeral "random_password" "jwt" {
  length  = 96 # the API requires at least 64 characters
  special = false
}

resource "google_secret_manager_secret_version" "jwt_token_key" {
  secret                 = google_secret_manager_secret.app["jwt-token-key"].id
  secret_data_wo         = ephemeral.random_password.jwt.result
  secret_data_wo_version = var.token_key_version

  # Cloud Run pins this version (cloudrun.tf); keep the old one until the new
  # revision is serving.
  lifecycle {
    create_before_destroy = true
  }
}

resource "google_secret_manager_secret_version" "db_connection_string" {
  secret                 = google_secret_manager_secret.app["db-connection-string"].id
  secret_data_wo         = "${local.db_connection_prefix};Password=${ephemeral.random_password.db.result}"
  secret_data_wo_version = local.db_credentials_version

  # Wait for the password to be set on the user before publishing it.
  depends_on = [google_sql_user.app]

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each = local.secret_env

  secret_id = google_secret_manager_secret.app[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.runtime.member
}
