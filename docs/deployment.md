# Deployment Guide

> **Target: Google Cloud** — Cloud Run + Cloud SQL for PostgreSQL at `https://khanara.shop`, provisioned with Terraform (`infra/terraform/`). The full plan, cost breakdown and first-time runbook are in [gcp-deployment-plan.md](gcp-deployment-plan.md).
>
> The app previously ran on Azure App Service with Azure SQL (see [Previous deployment](#previous-deployment-azure)).

---

## How the production deploy works

| | |
|---|---|
| **Hosting** | Cloud Run (one container, scales to zero, max 1 instance) |
| **Database** | Cloud SQL for PostgreSQL 17 (`db-f1-micro`), reached through Cloud Run's built-in Cloud SQL connector |
| **Secrets** | Secret Manager, injected as environment variables |
| **Background jobs** | Cloud Scheduler → `POST /api/jobs/*` with a Google-signed OIDC token |
| **Domain / TLS** | Cloud DNS + Cloud Run domain mapping with a Google-managed certificate |
| **Infrastructure** | Terraform (`infra/terraform/bootstrap`, `infra/terraform/prod`), applied by hand |
| **CI/CD** | GitHub Actions → Artifact Registry → `gcloud run deploy`, keyless via Workload Identity Federation |

1. `.github/workflows/ci.yml` builds and tests every push and PR.
2. When CI passes on a push to `main`, `.github/workflows/deploy-gcp.yml`:
   - authenticates to Google Cloud with Workload Identity Federation (no stored keys),
   - builds the root `Dockerfile` (Angular build → `dotnet publish` → ASP.NET runtime image) and pushes it to Artifact Registry,
   - rolls out a new Cloud Run revision with that image and checks `/health`.
3. Terraform owns every other setting of the service (env vars, secrets, scaling). It ignores the image, so CI deploys never cause drift.

---

## Build locally

```bash
docker build -t khanara:local .
```

The image serves the API and the Angular SPA on port 8080. Without Docker:

```bash
cd client && npm ci && npm run build        # output lands in backend/wwwroot/
cd ../backend && dotnet publish -c Release -o ./publish
```

---

## Database

The app uses PostgreSQL via EF Core (`UseNpgsql(...)` in `Program.cs`). Locally it runs in Docker (`docker compose up -d`, port 5433); in production it's Cloud SQL. Integration tests use in-memory SQLite and don't touch a real server.

Migrations run at startup (`MigrateAsync()` in `Program.cs`). That is safe on Cloud Run because the service is capped at one instance. If you ever raise `max_instance_count`, move migrations into the deploy pipeline first:

```bash
dotnet ef database update --project backend/Khanara.API.csproj --connection "<connection string>"
```

---

## Environment Variables

Set by Terraform in `infra/terraform/prod/cloudrun.tf`; secrets come from Secret Manager.

```
ConnectionStrings__DefaultConnection   (secret: khanara-db-connection-string, generated)
TokenKey                               (secret: khanara-jwt-token-key, generated)
CloudinarySettings__ApiKey             (secret: khanara-cloudinary-api-key)
CloudinarySettings__ApiSecret          (secret: khanara-cloudinary-api-secret)
Stripe__SecretKey                      (secret: khanara-stripe-secret-key)
Stripe__WebhookSecret                  (secret: khanara-stripe-webhook-secret)
CloudinarySettings__CloudName
Jwt__Issuer / Jwt__Audience            https://khanara.shop
Cors__AllowedOrigins__0 / __1          https://khanara.shop, https://www.khanara.shop
Stripe__SuccessUrl / Stripe__CancelUrl https://khanara.shop/... (the run.app URL until enable_domain_mapping is on)
Jobs__RunInProcess                     false
Jobs__OidcAudience                     https://khanara.shop/api/jobs
Jobs__SchedulerServiceAccountEmail     khanara-scheduler@<project>.iam.gserviceaccount.com
ASPNETCORE_FORWARDEDHEADERS_ENABLED    true
AllowedHosts                           *
```

---

## Stripe Webhooks

1. In the Stripe dashboard, create a webhook endpoint for `https://khanara.shop/api/payments/webhook`
2. Subscribe to `checkout.session.completed` and `charge.refunded`
3. Store the signing secret: `gcloud secrets versions add khanara-stripe-webhook-secret --data-file=-`

---

## Security Checklist

- [x] `TokenKey` is generated (96 chars) by Terraform and never stored in state
- [x] HTTPS enforced by Cloud Run; forwarded headers enabled so HSTS and the per-IP rate limiter see the real client
- [x] `Cors:AllowedOrigins` locked to `khanara.shop` and `www.khanara.shop`
- [x] Stripe webhook signature verification enabled (handled by `PaymentsController`)
- [x] Cloud SQL has no authorized networks; only the Cloud SQL connector (IAM) can reach it
- [x] `/api/jobs/*` accepts only OIDC tokens issued to the scheduler service account
- [ ] The 10 seeded catalog cook accounts (`Data/Seed.cs`) share a password committed to this repo. Change them on the live database or gate the seeding
- [ ] Image upload size limit (5 MB) reviewed for production load

---

## Background Jobs

| Job | Schedule | Purpose |
|---|---|---|
| `AbandonedOrderCleanupJob` | Every 15 min | Cancels Pending Stripe orders >45 min old, restores portions |
| `DailyPortionsResetJob` | Daily at `DailyReset:CutoverHourUtc` (default 03:00 UTC) | Resets dish portions, minus portions held by active orders. Runs at most once per UTC day (`JobRuns` table) |

- **Default (`Jobs:RunInProcess=true`)**: two `BackgroundService` timers run the jobs. Use this for local development and any always-on host.
- **Cloud Run (`Jobs:RunInProcess=false`)**: the instance scales to zero, so Cloud Scheduler calls `POST /api/jobs/abandoned-order-cleanup` and `POST /api/jobs/daily-portions-reset` (`JobsController`). Both jobs are safe to retry.

---

## Previous deployment (Azure)

Until June 2026 the API and SPA ran on **Azure App Service (Linux, .NET 10)** with **Azure SQL Database**, deployed by `.github/workflows/main_khanara.yml` (now disabled) using OIDC federated credentials. It went offline when the Azure free tier expired.

### Azure App Service — Overview

![Azure App Service overview showing the khanara web app healthy and running on .NET 10](screenshots/image-1.png)

### Deployment Center — automated GitHub Actions deploy

![Azure Deployment Center showing a successful GitHubAction deployment](screenshots/image-2.png)

### GitHub Actions — build & deploy pipeline

![GitHub Actions run showing the build and deploy jobs passing](screenshots/image-3.png)

> Screenshots live in [`docs/screenshots/`](screenshots/) — see the README there for exactly what to capture and a quick privacy note before committing.
