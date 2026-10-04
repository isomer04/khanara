# ADR 0003: Use the .NET chiseled-extra runtime image

- Status: Accepted
- Date: 2026-10-04
- Related: [implementation plan](../plans/reduce-hosting-costs.md), [deployment guide](../deployment.md#build-locally)

## Context

The existing multistage Dockerfile already excludes Node and the .NET SDK from
the final container. Its full ASP.NET runtime base still includes operating-system
packages that the application does not need. Image size affects local storage,
image distribution and potentially cold starts, but a smaller image alone does
not establish monthly savings or a startup-latency improvement.

## Decision

Use `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra` for the runtime stage.
The `extra` variant retains ICU and timezone data instead of requiring invariant
globalization. Retain the Node build stage, .NET SDK publish stage, application
assets, port 8080, non-root `APP_UID` and the existing startup command.

Copy published files with `--chown=$APP_UID:$APP_UID`. Preserve framework-dependent
publishing; do not introduce trimming, native AOT, Alpine/musl, or remove runtime
packages without compatibility evidence.

## Alternatives considered

| Alternative | Reason for not choosing it |
|---|---|
| Keep the full runtime image | Compatible but larger than the tested alternative |
| Chiseled without `extra` | Requires changes to globalization assumptions and excludes ICU/timezone support |
| Alpine, trimming or native AOT | Adds compatibility work beyond the validated runtime-base change |

## Consequences and revisit criteria

The runtime has no shell or package manager. Diagnose through application logs,
external HTTP checks and separate tooling containers. Keep build tooling outside
the final runtime. Revisit if a new dependency requires missing native utilities
or validation finds a platform-specific regression.

On 2026-10-04, identical application builds using the previous and chosen runtime
bases reported 432 MB and 329 MB in `docker image ls`, respectively: about 24% less
Docker local image storage on the validation machine. This is not a registry
billing measurement, monthly savings calculation, or cold-start benchmark.

## Validation and references

Both images built successfully. The optimized production image passed an isolated
PostgreSQL 17 smoke check covering startup migrations, SPA fallback/assets,
registration/login, an authenticated WebSocket handshake and restart persistence.
The final rebuild passed the same smoke check; temporary test resources were removed.

- [Microsoft .NET image variants](https://github.com/dotnet/dotnet-docker/blob/main/documentation/image-variants.md)
- [Dockerfile](../../Dockerfile)
- [Repeatable container smoke check](../../scripts/smoke-container.mjs)
