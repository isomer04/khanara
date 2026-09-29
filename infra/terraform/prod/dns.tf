# After the first apply, point the registrar's nameservers at the
# `dns_name_servers` output. Copy any records you still need (for example
# the Cloud Identity google-site-verification TXT) into the variables first.

resource "google_dns_managed_zone" "main" {
  name        = replace(var.domain, ".", "-")
  dns_name    = "${var.domain}."
  description = "Managed by Terraform (infra/terraform/prod)"

  depends_on = [google_project_service.apis]
}

# Fixed addresses Google publishes for Cloud Run domain mappings on an apex
# domain. Compare with the `domain_mapping_records` output after apply.
locals {
  cloud_run_apex_a    = ["216.239.32.21", "216.239.34.21", "216.239.36.21", "216.239.38.21"]
  cloud_run_apex_aaaa = ["2001:4860:4802:32::15", "2001:4860:4802:34::15", "2001:4860:4802:36::15", "2001:4860:4802:38::15"]
}

resource "google_dns_record_set" "apex_a" {
  managed_zone = google_dns_managed_zone.main.name
  name         = google_dns_managed_zone.main.dns_name
  type         = "A"
  ttl          = 300
  rrdatas      = local.cloud_run_apex_a
}

resource "google_dns_record_set" "apex_aaaa" {
  managed_zone = google_dns_managed_zone.main.name
  name         = google_dns_managed_zone.main.dns_name
  type         = "AAAA"
  ttl          = 300
  rrdatas      = local.cloud_run_apex_aaaa
}

resource "google_dns_record_set" "www" {
  managed_zone = google_dns_managed_zone.main.name
  name         = "www.${google_dns_managed_zone.main.dns_name}"
  type         = "CNAME"
  ttl          = 300
  rrdatas      = ["ghs.googlehosted.com."]
}

resource "google_dns_record_set" "apex_txt" {
  count = length(var.apex_txt_records) > 0 ? 1 : 0

  managed_zone = google_dns_managed_zone.main.name
  name         = google_dns_managed_zone.main.dns_name
  type         = "TXT"
  ttl          = 3600
  rrdatas      = [for r in var.apex_txt_records : "\"${r}\""]
}

resource "google_dns_record_set" "mx" {
  count = length(var.mx_records) > 0 ? 1 : 0

  managed_zone = google_dns_managed_zone.main.name
  name         = google_dns_managed_zone.main.dns_name
  type         = "MX"
  ttl          = 3600
  rrdatas      = var.mx_records
}

# Cloud Run domain mappings are free (a global load balancer would cost about
# $18/month) but in preview. The account running Terraform must be a verified
# owner of the domain: gcloud domains list-user-verified.
resource "google_cloud_run_domain_mapping" "app" {
  for_each = toset([var.domain, "www.${var.domain}"])

  name     = each.value
  location = var.region

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
