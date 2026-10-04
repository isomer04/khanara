# Plan: Reduce Khanara's hosting costs

- Date: 2026-10-04
- Branch: `infra/reduce-hosting-costs`, created from updated `main`
- Status: Implementation and local validation complete; production rollout pending
- Decisions: [ADR index](../adr/README.md)

## Goal and selected defaults

Reduce unnecessary application compute activity and runtime image size while
retaining durable marketplace data and existing features. Khanara already serves
Angular, .NET and SignalR from one container and uses request-based billing with
0–1 configured Cloud Run instances.

The user selected retaining Cloud SQL, pausing hidden-tab sockets after 30 seconds,
and implementing image optimization plus cold-start recovery. Preserve Terraform
settings, Scheduler cadence, backups and image-retention policies. No new backend
API, database schema or infrastructure change is required. Fixed database costs remain.

## Implementation

1. Create `infra/reduce-hosting-costs` from updated `main` and preserve existing work.
2. Switch the runtime to `aspnet:10.0-noble-chiseled-extra`; retain globalization,
   the multistage build, static assets, non-root user and port 8080. Copy published
   output with ownership assigned to the runtime user.
3. Manage document visibility in `OrderHubService`: pause after 30 seconds hidden,
   cancel the timer on early return, retain order IDs during suspension, reconnect
   and rejoin on return, and fully cancel/clear on navigation away.
4. Bound initial connection retries to two additional attempts after 1 and 3
   seconds. Serialize shutdown before starting a replacement, cancel retries when
   leaving or suspending, and ignore stale callbacks. Retain established-connection
   automatic reconnect.
5. Expose connection state and a restoration event. Reload order status and message
   history after groups are restored; reconcile concurrent events, deduplicate IDs,
   preserve drafts, and clear disconnected presence. Add visible recovery status
   and a manual retry action.
6. Add safe-read retries inside existing loading/error interceptors: only application
   API GETs, only network failures or HTTP 502/503/504, with two retries at 1 and 3
   seconds. Keep loading active throughout and surface final failure once. Do not
   replay checkout, orders, messages or token refresh.
7. Add a repeatable production-container smoke check and document the decisions,
   measured image result and operational limitations.

## Validation and evidence

- Final frontend suite with coverage: 52 files passed, 784 tests passed, 3 skipped.
  All configured 70% coverage thresholds passed: statements 81.69%, branches 72.46%,
  functions 72.83%, lines 82.53%.
- Backend suite: 181 passed, 2 skipped. Existing NuGet vulnerability warnings for
  Moq and SQLitePCLRaw remain outside this change.
- Angular production build and both Docker runtime variants built successfully.
- CI-equivalent backend formatting check passed. A broader solution-wide check
  reports existing whitespace issues in unchanged backend test files. All 42 added
  local documentation links resolve and `git diff --check` passes.
- Final optimized image passed PostgreSQL 17 migrations, SPA routes/assets,
  registration/login, authenticated WebSocket connection and restart persistence.
  Smoke containers and network were removed.
- Regression scenarios cover retry limits/exclusions, cancellation, a single loading
  interval, tab visibility timing, membership restoration, stale callbacks, overlapping
  shutdowns, manual recovery, missed updates, live/reload races and draft preservation.
- Docker local storage comparison: 432 MB baseline versus 329 MB optimized, about
  24% smaller. No monthly cost or cold-start latency improvement was measured.

## Delivery and rollout

Commit implementation, plan, ADRs and reference updates together and open a PR
against `main`. Existing CI must pass and the repository requires review before
merge. Merging into `main` uses the existing deployment workflow to publish the
image and roll out Cloud Run; creating the PR does not deploy it.

After release, verify health, login, an order/chat connection, hidden-tab pause,
return-to-tab recovery and retained data. Observe application errors, connection
failures and billed usage before claiming cost savings. Roll back to the prior
image revision if production checks fail. No Terraform apply or data migration is
needed for this change.

## References

- [Deployment guide and smoke-check command](../deployment.md)
- [Original GCP architecture and historical cost estimates](../gcp-deployment-plan.md)
- [Architecture overview](../architecture.md)
