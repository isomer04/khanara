# Architecture Overview

Khanara is a full-stack web application with three main layers: an Angular SPA, an ASP.NET Core REST API, and a SQL Server database (Docker container in development, Azure in production). Integration tests swap in an in-memory SQLite database.

```
┌─────────────────────────────────┐
│         Angular SPA             │  https://localhost:5444
│  (standalone components, lazy   │
│   routes, signals, RxJS)        │
└────────────┬────────────────────┘
             │ HTTPS REST + WebSocket (SignalR)
┌────────────▼────────────────────┐
│      ASP.NET Core 10 API        │  https://localhost:7071
│  Controllers → UnitOfWork →     │
│  Repositories → EF Core         │
│                                 │
│  Hosted services (background)   │
│  SignalR OrderHub (WebSocket)   │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐     ┌─────────────┐
│   SQL Server (Docker in dev,    │     │  Cloudinary │
│   Azure in production)          │     │  (images)   │
└─────────────────────────────────┘     └─────────────┘
                                        ┌─────────────┐
                                        │   Stripe    │
                                        │  (payments) │
                                        └─────────────┘
```

---

## Backend Layer Structure

```
Controllers          → HTTP surface; delegate to UnitOfWork, services
  ↓
UnitOfWork           → Single SaveChanges boundary; owns all repositories
  ↓
Repositories         → EF Core queries; return domain entities or DTOs
  ↓
AppDbContext         → EF Core DbContext with UTC converters and model config
  ↓
SQL Server           → Persistent storage
```

**Services** (not repositories) handle cross-cutting logic:
- `TokenService` — JWT and refresh token generation
- `PhotoService` — Cloudinary upload with magic-byte validation
- `StripeService` — checkout session, refund, session expiry
- `OrderNotificationService` — scoped SignalR broadcaster (called from controllers)

**Background services** run independently of the request pipeline:
- `AbandonedOrderCleanupService`
- `DailyPortionsResetService`

### Backend project layout

```
backend/
├── Khanara.API.csproj
├── Program.cs                       # Startup, DI, middleware pipeline
├── API.http                         # REST Client requests for manual testing
├── appsettings.json                 # Default config
├── appsettings.Development.json     # Dev secrets (gitignored)
├── appsettings.Development.json.example
├── Properties/                      # launchSettings.json
├── Controllers/                     # HTTP endpoints
├── DTOs/                            # Request/response shapes (separate from Entities)
├── Entities/                        # EF Core entity classes
├── Data/                            # AppDbContext, UnitOfWork, Repositories, Seed, Migrations
├── Services/                        # Cross-cutting + background services
├── SignalR/                         # OrderHub, OrderPresenceTracker
├── Middleware/                      # ExceptionMiddleware (and any custom pipeline)
├── Extensions/                      # ServiceCollection / ApplicationBuilder helpers
├── Helpers/                         # PaginationParams, CloudinarySettings, etc.
├── Interfaces/                      # IServiceX / IRepositoryX / IUnitOfWork contracts
├── Errors/                          # ApiException, ApiResponse, ApiValidationErrorResponse
├── Migrations/                      # EF Core generated migrations
├── Assets/                          # Static server-side assets (e.g. default avatars)
├── wwwroot/                         # Web root served by the API
├── publish/                         # Output of `dotnet publish`
├── bin/, obj/                       # Build output
└── Khanara.API.Tests/               # xUnit project (unit, integration, concurrency)
```

---

## Key Domain Entities

| Entity | Notes |
|---|---|
| `AppUser` | Extends `IdentityUser`; has optional `CookProfile` nav |
| `CookProfile` | Kitchen details, cuisine tags, ZIP service zones, ratings |
| `Dish` | Linked to a cook; `PortionsRemainingToday` has a `[ConcurrencyCheck]` |
| `Order` | Full lifecycle: Pending → Accepted → Preparing → Ready → Delivered / Cancelled |
| `OrderItem` | Line items linking an Order to Dishes |
| `Message` | In-order chat messages |
| `Review` | 1:1 with Order; cook can reply; rating 1–5 enforced by DB check constraint |
| `CartItem` | Quantity 1–100 check constraint; concurrency token |
| `Favorite` | Composite key (EaterUserId + CookProfileId) |

---

## Real-time (SignalR)

`OrderHub` manages group-based presence:

- Clients call `JoinOrder` / `LeaveOrder` to subscribe to a specific order's events.
- `OrderPresenceTracker` (singleton) tracks which users are viewing which order.
- `OrderNotificationService` (scoped, called from controllers) broadcasts status changes and new messages to the relevant group.
- The Angular `OrderHubService` wraps the SignalR client and exposes observables.

---

## Auth Flow

```
POST /api/account/login
  → returns JWT access token (60 min) in response body
  → sets HttpOnly Secure SameSite=Strict refresh token cookie

POST /api/account/refresh-token
  → reads refresh cookie, validates hash, issues new access + refresh pair
  → old refresh token is invalidated (rotation)

POST /api/account/logout
  → clears refresh token from DB and cookie
```

---

## Frontend Structure

```
client/src/
├── index.html                       # App shell
├── main.ts                          # bootstrapApplication entry
├── styles.scss                      # Global styles (Tailwind layers + theme tokens)
├── test-setup.ts                    # Karma/Jasmine test bootstrapping
│
├── app/                            # Root standalone component + per-area pages
│   ├── app.ts / app.html / app.scss # Root <app-root>
│   ├── app.config.ts                # Providers (router, http, interceptors, …)
│   ├── app.routes.ts                # Top-level route table (all lazy)
│   ├── app.spec.ts                  # Root component spec
│   ├── account/                     # Login, register, profile pages
│   ├── admin/                       # Admin panel pages
│   ├── cook-dashboard/              # Cook's own profile / dish / order management
│   ├── cooks/                       # Public cook discovery & cook detail pages
│   ├── favorites/                   # Favorites list page
│   ├── home/                        # Landing page
│   ├── orders/                      # Order list + order detail (chat, status)
│   ├── reviews/                     # Review composition / display pages
│   └── test-errors/                 # Dev-only error-page playground
│
├── core/                            # App-wide singletons (provided in root)
│   ├── guards/       # authGuard, adminGuard, cookGuard, noCookProfileGuard
│   ├── interceptors/ # jwtInterceptor, errorInterceptor, loadingInterceptor
│   ├── services/     # All singleton services (AccountService, OrderService, …)
│   ├── layout/       # App shell components (navbar, container, footer)
│   └── pipes/        # Reusable template pipes
│
├── features/         # Lazy-loaded feature components (one folder per route group)
│   ├── account/                    # Login, register, profile (member-edit)
│   ├── admin/                      # Admin panel (photo-management, user-management)
│   ├── cook-dashboard/             # Cook's own UI (dashboard, dish-form, onboarding)
│   ├── cooks/                      # Public cook discovery (cook-list, cook-detail)
│   ├── favorites/                  # Favorites list
│   ├── home/                       # Landing page
│   ├── orders/                     # Order list + detail (chat, status)
│   └── reviews/                    # Review composition / display
│
├── shared/           # Reusable UI building blocks
│   ├── cook-card/
│   ├── paginator/
│   ├── image-upload/
│   ├── confirm-dialog/
│   ├── delete-button/
│   ├── favorite-button/
│   ├── text-input/
│   ├── errors/                      # Error display components
│   └── directives/                  # Reusable Angular directives
│
├── testing/                        # Unit-test infrastructure (no app code)
│   ├── mock-services.ts             # Reusable service mocks
│   ├── test-data-builders.ts        # Factories for domain objects
│   ├── test-utils.ts                # Common helpers (routing, http stubs, …)
│   └── test-infrastructure.spec.ts  # Smoke test for the test harness itself
│
├── types/            # TypeScript interfaces for all API response shapes
│   ├── user.ts / member.ts / cook-profile.ts
│   ├── dish.ts / order.ts / message.ts / review.ts / favorite.ts
│   ├── pagination.ts / error.ts
│
└── environments/     # environment.ts / environment.development.ts
```

All routes are lazy-loaded standalone components — no NgModules.

Spec files (`*.spec.ts`) live next to the units they test, not in a separate folder.
