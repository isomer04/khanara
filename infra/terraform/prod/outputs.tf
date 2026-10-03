output "service_url" {
  description = "Default run.app URL (works before DNS is switched)."
  value       = google_cloud_run_v2_service.app.uri
}

output "site_url" {
  value = local.site_url
}

output "dns_name_servers" {
  description = "Set these as the nameservers at your domain registrar."
  value       = google_dns_managed_zone.main.name_servers
}

output "domain_mapping_records" {
  description = "Records Cloud Run expects; should match the ones in dns.tf."
  value = {
    for name, m in google_cloud_run_domain_mapping.app :
    name => try(m.status[0].resource_records, [])
  }
}

output "cloudsql_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "image_repository" {
  value = local.image_repo
}

# Copy these into GitHub: Settings → Secrets and variables → Actions → Variables.
output "github_actions_variables" {
  value = {
    GCP_PROJECT_ID        = var.project_id
    GCP_REGION            = var.region
    GCP_WIF_PROVIDER      = google_iam_workload_identity_pool_provider.github.name
    GCP_DEPLOYER_SA       = google_service_account.deployer.email
    GCP_SERVICE           = google_cloud_run_v2_service.app.name
    GCP_ARTIFACT_REGISTRY = local.image_repo
  }
}
