resource "google_sql_database_instance" "main" {
  name                = "${var.service_name}-pg"
  database_version    = var.db_version
  region              = var.region
  deletion_protection = true

  settings {
    # Shared-core tiers (db-f1-micro) only exist in the Enterprise edition.
    edition           = "ENTERPRISE"
    tier              = var.db_tier
    availability_type = "ZONAL"

    disk_type             = "PD_SSD"
    disk_size             = 10
    disk_autoresize       = true
    disk_autoresize_limit = 20

    deletion_protection_enabled = true

    backup_configuration {
      enabled                        = true
      start_time                     = "08:00" # UTC
      point_in_time_recovery_enabled = false
      backup_retention_settings {
        retained_backups = 7
      }
    }

    # Public IP with no authorized networks: nothing can connect directly.
    # Cloud Run reaches the instance through its built-in Cloud SQL connector
    # (IAM-authorized, TLS), which avoids paying for a VPC connector.
    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 9 # UTC
      update_track = "stable"
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_sql_database" "app" {
  name            = "khanara"
  instance        = google_sql_database_instance.main.name
  deletion_policy = "ABANDON"
}

# Regenerated on every run but only sent when local.db_credentials_version
# (secrets.tf) changes. The same value feeds the connection-string secret, so
# both always change together and the password is never stored in state.
ephemeral "random_password" "db" {
  length  = 40
  special = false # keeps the Npgsql connection string free of ; and =
}

resource "google_sql_user" "app" {
  name                = local.db_user
  instance            = google_sql_database_instance.main.name
  password_wo         = ephemeral.random_password.db.result
  password_wo_version = local.db_credentials_version

  # Postgres refuses to drop a role that owns tables; leave it on destroy.
  deletion_policy = "ABANDON"
}
