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

The runtime uses `.NET 10 noble-chiseled-extra`, retaining ICU and timezone data
while removing unused operating-system packages. Published files are owned by the
non-root runtime user. There is no shell in this image; use container logs and
external HTTP checks for diagnosis.

```bash
docker build -t khanara:local .
```

### Cost and cold-start behavior

The [saved implementation plan](plans/reduce-hosting-costs.md) records the agreed
changes and validation. The [ADRs](adr/README.md) explain the storage/billing,
connection lifecycle and runtime-image decisions.

- Cloud Run retains min 0 / max 1 instances and request-based billing. Cloud SQL
  retains durable accounts, orders, payments and messages, and still has ongoing costs.
- Order/chat sockets pause after 30 continuous seconds in a hidden tab. Returning
  reconnects, rejoins the order and reloads missed status/messages without clearing
  drafts. Navigation away disconnects immediately. A visible order tab still holds
  an active request; other tabs and Scheduler requests can also keep the service active.
- API GETs retry network failures and HTTP 502/503/504 twice, after 1 and 3 seconds.
  Initial SignalR starts use the same bounded delays; established connections retain
  SignalR automatic reconnect. Failed live connections expose a manual retry button.
  Checkout, order/message writes and token refresh are never automatically replayed.
- The initial HTML comes from the same container, so in-app loading indicators only
  appear after that response arrives; they cannot cover the first document cold start.

On 2026-10-04, identical application builds using the previous and new runtime bases
reported **432 MB and 329 MB** respectively in `docker image ls` (about 24% less local
image storage). This measures Docker's local storage, not monthly savings,
registry billing, or cold-start latency.

After building, run the isolated production-container check with:

```bash
node scripts/smoke-container.mjs khanara:local
```

It uses PostgreSQL 17 and dummy third-party credentials, checks startup migrations,
SPA routes/assets, registration/login, an authenticated WebSocket handshake and
restart persistence, then removes its own temporary containers and network. Install
client dependencies first; Docker must be available. It does not call Stripe or Cloudinary.

Deploy the validated image through the existing GitHub Actions release workflow.
This change needs no Terraform apply or database migration. Roll back by deploying
the previous image revision if production smoke checks fail.

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
3. Put the signing secret in `third_party_secrets["stripe-webhook-secret"]` in `infra/terraform/prod/terraform.tfvars`, bump `third_party_secrets_version`, and run `terraform apply`. `terraform output stripe_webhook_url` shows the endpoint URL to register (the run.app URL until `enable_domain_mapping` is on)

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
