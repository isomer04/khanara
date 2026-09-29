output "project_id" {
  value = local.project_id
}

output "state_bucket" {
  description = "Put this in ../prod/backend.hcl as `bucket`."
  value       = google_storage_bucket.tfstate.name
}
