# ADR 0002: Pause hidden-tab connections and bound retries

- Status: Accepted
- Date: 2026-10-04
- Related: [ADR 0001](0001-retain-durable-storage-and-request-based-billing.md), [implementation plan](../plans/reduce-hosting-costs.md)

## Context

Order detail and chat already disconnect on navigation away, but a tab left open
in the background can hold a WebSocket indefinitely. That keeps a Cloud Run request
active and billed. Meanwhile cold starts and temporary network failures can affect
safe reads and initial SignalR connections. SignalR's automatic reconnect handles
established connections, but does not retry a failed initial start.

## Decision

Pause order connections after 30 continuous seconds with the document hidden.
Returning earlier cancels the timer. Returning after suspension reconnects and
rejoins remembered order groups; leaving the page cancels timers and retries,
stops the connection and clears membership. Serialize connection shutdowns before
starting another connection and ignore callbacks from discarded connections.

After restored group membership, reload the order and message history through
REST. Preserve live updates received during reloads, deduplicate messages by ID,
preserve unsent drafts, and clear stale presence while disconnected. Show connecting
or reconnecting status and offer a manual retry after connection recovery fails.

Retry initial SignalR starts twice, after 1 and 3 seconds; retain existing automatic
reconnect for established connections. Retry only same-origin application API GETs
for network failures and HTTP 502/503/504, using the same delays and attempt limit.
Keep one loading interval across read attempts and report only the final failure.
Unsubscribing cancels pending HTTP retries.

Do not automatically replay order/payment/message mutations or token refresh.
These operations may have committed before their responses were lost; token refresh
also rotates durable credentials. Other HTTP errors, including 401, 429 and 500,
remain outside the read retry policy.

## Alternatives considered

| Alternative | Reason for not choosing it |
|---|---|
| Keep background tabs connected | Preserves hidden-tab updates but retains unnecessary active requests |
| Disconnect immediately when hidden | Brief tab switches cause avoidable reconnects; 30 seconds is the selected grace period |
| Poll instead of SignalR | Changes the interaction model and adds recurring reads; not needed for this change |
| Automatically retry every request | Can duplicate side effects or replay rotated refresh tokens |

## Consequences and revisit criteria

Background tabs receive no live events while paused; REST reconciliation catches
up on return. Presence reflects active connections rather than all open tabs.
Visible order tabs can still keep compute active. Browser timer throttling can
delay the pause beyond 30 seconds, so the grace period is not a precise billing cap.

The initial HTML shares the backend container, so application loading UI cannot
cover the cold start before that document is delivered. Retried requests have
bounded attempt counts, not a guaranteed overall response deadline. Revisit if
background notifications become a product requirement or measured recovery behavior
justifies different timing.

## Validation and references

Regression tests cover retry exhaustion and cancellation, hidden-tab suspension
and early return, group restoration, old callbacks, serialized shutdowns, manual
retry UI, stale presence, drafts and reconciliation with concurrent live events.

- [SignalR JavaScript client recovery](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client?view=aspnetcore-10.0)
- [Order connection service](../../client/src/core/services/order-hub-service.ts)
- [Read retry interceptor](../../client/src/core/interceptors/read-retry-interceptor.ts)
