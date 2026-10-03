# Terraform: Khanara on Google Cloud

The architecture, costs, decisions and the full first-time runbook are in [docs/gcp-deployment-plan.md](../../docs/gcp-deployment-plan.md). This file is the short version.

| Stack | State | Creates |
|---|---|---|
| [`bootstrap/`](bootstrap) | local (`terraform.tfstate`, back it up) | base APIs and the versioned GCS bucket for remote state; optionally the project |
| [`prod/`](prod) | GCS bucket from bootstrap | Cloud Run, Cloud SQL (Postgres), Secret Manager, Cloud Scheduler, Cloud DNS + domain mappings, Artifact Registry, GitHub WIF, budget |

```powershell
$env:CLOUDSDK_CONFIG = "$HOME\.gcloud-khanara"   # keeps this login separate from other gcloud accounts
$env:GOOGLE_APPLICATION_CREDENTIALS = "$env:CLOUDSDK_CONFIG\application_default_credentials.json"

cd bootstrap
terraform init; terraform apply

cd ../prod
terraform init -backend-config=backend.hcl
terraform plan -out tfplan; terraform apply tfplan
```

Things to know:

- **No secrets in state.** The DB password and JWT key are generated with ephemeral resources and sent through write-only arguments. Stripe/Cloudinary keys are added with `gcloud secrets versions add` (see the runbook).
- **CI owns the image.** `deploy-gcp.yml` rolls out new images; Terraform ignores image changes. A `terraform plan` right after a deploy should show no changes.
- **Rotate** by bumping `db_password_version` / `token_key_version`. The apply rolls out a new Cloud Run revision with the new value.
- `*.tfvars`, `backend.hcl`, state and `.terraform/` are gitignored. Only the `*.example` files are committed.
