# Architecture decision records

ADRs explain why Khanara chose an approach, which alternatives were considered,
and what would justify revisiting it. They record accepted engineering decisions;
acceptance does not mean the corresponding changes have been deployed.

| ADR | Status | Decision |
|---|---|---|
| [0001](0001-retain-durable-storage-and-request-based-billing.md) | Accepted | Retain Cloud SQL and one scale-to-zero service with request-based billing |
| [0002](0002-pause-hidden-tab-connections-and-bound-retries.md) | Accepted | Pause hidden-tab order connections and bound automatic retries |
| [0003](0003-use-chiseled-extra-runtime-image.md) | Accepted | Use the .NET chiseled-extra runtime while retaining globalization |

See the [implementation plan](../plans/reduce-hosting-costs.md),
[deployment guide](../deployment.md), and [architecture overview](../architecture.md).

New records use the next available four-digit number and include status, date,
context, decision, alternatives, consequences, and validation. Supersede an old
decision with a new record and link the two instead of deleting its rationale.
