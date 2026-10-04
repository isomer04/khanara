# ADR 0001: Retain durable storage and request-based billing

- Status: Accepted
- Date: 2026-10-04
- Related: [implementation plan](../plans/reduce-hosting-costs.md), [deployment guide](../deployment.md#cost-and-cold-start-behavior)

## Context

Cloudcause demonstrated a useful cost pattern: consolidate containers, scale to
zero, and avoid always-on dependencies. Khanara already serves Angular, the .NET
API and SignalR from one Cloud Run container. Unlike temporary investigation
history, its accounts, orders, payments, messages and job-run records must survive
instance restarts. Moving that data into memory would break the marketplace.

Khanara's production jobs are invoked by Cloud Scheduler and awaited before the
HTTP response completes. They do not require CPU after returning a response.
SignalR presence is in memory and has no distributed backplane.

## Decision

Retain Cloud SQL for PostgreSQL and the consolidated Cloud Run service. Preserve
`min_instance_count = 0`, `max_instance_count = 1`, `cpu_idle = true`, and
`Jobs__RunInProcess = false` in production. Keep Scheduler cadence, backups,
database deletion protection and image-retention policies unchanged.

Continue request-based billing rather than copying Cloudcause's `cpu_idle = false`.
Retain the configured instance limit until distributed presence and deployment-time
migrations are addressed. Treat scale-to-zero as an application-compute saving,
not elimination of the project's fixed costs or a hard spending cap.

## Alternatives considered

| Alternative | Reason for not choosing it |
|---|---|
| Store application data in memory | Loses essential durable state on restart |
| Move to a PostgreSQL provider that suspends when idle | Requires a provider/data migration and separate reliability assessment; user chose to retain Cloud SQL |
| Always-allocated CPU or a warm minimum instance | Adds idle compute cost without a production job requirement |
| Split services or add Redis | Adds infrastructure and operational complexity without a demonstrated workload need |

## Consequences and revisit criteria

Cold starts remain possible. Open WebSockets are active requests and can prevent
idle scale-down, and the 15-minute cleanup schedule wakes the application. Cloud
SQL and supporting services continue to cost money. Existing monthly estimates
are historical planning figures, not measured savings or current price guarantees.

Revisit if background work must continue after responses, measured traffic makes
another billing mode cheaper, or demand requires multiple app instances. Increasing
capacity requires reviewing presence synchronization and migration concurrency;
an instance-count setting alone does not guarantee correctness during rollouts.

## Validation and references

The production-mode Docker smoke check ran against PostgreSQL 17, applied startup
migrations, exercised login and authenticated SignalR, and verified account
persistence after restarting the application. No schema or Terraform change is
introduced by this cost-optimization work.

- [Cloud Run billing settings](https://docs.cloud.google.com/run/docs/configuring/billing-settings)
- [Cloud Run WebSockets and billing](https://docs.cloud.google.com/run/docs/triggering/websockets)
- [Terraform service configuration](../../infra/terraform/prod/cloudrun.tf)
- [Scheduler configuration](../../infra/terraform/prod/scheduler.tf)
