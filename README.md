# Khanara

A modern home-cooked food marketplace connecting home cooks with food enthusiasts, specializing in Asian and Arabian cuisines.

## Demo
<img width="100%" alt="Khanara – Browse Cooks" src="https://github.com/user-attachments/assets/ae88b16c-18df-4d71-a9a0-0e13577270fd" />


## Overview

Khanara is a full-stack web application that enables home cooks to showcase and sell their homemade dishes while giving customers access to authentic, home-cooked meals from their local community. The platform features real-time order tracking, in-app messaging, and a comprehensive review system.

## Key Features

### For Customers
- **Browse & Discover** — Explore dishes by cuisine type, dietary preferences, and cook ratings
- **Smart Ordering** — Real-time portion availability tracking and flexible scheduling
- **Cash on pickup/delivery** — Card payments via Stripe are implemented on the backend but currently disabled in the UI (coming soon)
- **Order Tracking** — Real-time status updates from placement to delivery
- **In-App Messaging** — Direct communication with cooks for special requests
- **Reviews & Ratings** — Share feedback and help others discover great cooks
- **Favorites** — Save cooks for quick access
- **Shopping Cart** — Manage multiple items before checkout

### For Cooks
- **Cook Profiles** — Create detailed profiles with kitchen photos and bio
- **Dish Management** — Add dishes with photos, descriptions, pricing, and dietary tags
- **Portion Control** — Set daily batch sizes with automatic inventory tracking
- **Order Management** — Accept, prepare, and fulfill orders with status workflows
- **Customer Communication** — Chat with customers about their orders
- **Service Areas** — Define delivery zones by ZIP codes
- **Availability Control** — Toggle accepting orders on/off as needed

### For Administrators
- **User Management** — Manage user accounts and roles
- **Content Moderation** — Review and moderate photos and content
- **Platform Oversight** — Monitor orders and resolve disputes

## Technology Stack

### Backend (`/backend`)
- **Framework**: ASP.NET Core 10.0
- **Database**: SQLite with Entity Framework Core
- **Authentication**: ASP.NET Core Identity with JWT + refresh tokens (hashed, rotated)
- **Real-time**: SignalR for live order updates and presence tracking
- **Payments**: Stripe API with webhook support (wired up; UI currently disabled)
- **Image Storage**: Cloudinary (user/dish photos)
- **API Docs**: Swagger / OpenAPI

### Frontend (`/client`)
- **Framework**: Angular 21 (standalone components, lazy-loaded routes)
- **Styling**: DaisyUI + Tailwind CSS 4
- **Reactive State**: RxJS + Angular signals
- **Real-time**: `@microsoft/signalr` client
- **Testing**: Vitest + `@analogjs/vite-plugin-angular` with coverage reporting
- **Build**: Angular CLI with Vite

### Backend Tests (`/backend/Khanara.API.Tests`)
- **Framework**: xUnit with Moq
- **Coverage**: Coverlet
- **Scope**: Unit, integration, and concurrency tests
- **Test infrastructure**: `CustomWebApplicationFactory` with in-memory SQLite, isolated per test class

## Project Structure

```
khanara/
├── .github/
│   └── workflows/                  # CI/CD (build, test, Trivy scan, lint)
├── backend/                        # ASP.NET Core API
│   ├── Controllers/                # HTTP endpoints
│   ├── Data/                       # EF Core DbContext, repositories, migrations
│   ├── DTOs/                       # API request/response contracts
│   ├── Entities/                   # Domain models
│   ├── Errors/                     # Custom error response types
│   ├── Extensions/                 # Extension methods
│   ├── Helpers/                    # Query params, pagination, settings
│   ├── Interfaces/                 # Repository and service abstractions
│   ├── Middleware/                 # Exception handling (ProblemDetails), security headers
│   ├── Services/                   # Business logic, token service, background services
│   ├── SignalR/                    # OrderHub + presence tracker
│   ├── wwwroot/                    # Served dish and kitchen images
│   ├── Khanara.API.csproj
│   ├── Program.cs                  # App entry point and DI configuration
│   └── Khanara.API.Tests/          # Backend test project (xUnit)
│       ├── Builders/               # Fluent test data builders (User, Cook, Dish, Order)
│       ├── Concurrency/            # Concurrency and race condition tests
│       ├── Helpers/                # Assertion extensions, auth helpers, data seeders
│       ├── Infrastructure/         # CustomWebApplicationFactory, BaseIntegrationTest
│       ├── Integration/
│       │   ├── Controllers/        # Integration tests per controller
│       │   └── SignalR/            # SignalR hub integration tests
│       ├── Mocks/                  # Mock implementations (photo, Stripe)
│       ├── Unit/
│       │   ├── Data/               # Data layer unit tests
│       │   ├── Repositories/       # Repository unit tests
│       │   └── Services/           # Service unit tests
│       └── Khanara.API.Tests.csproj
│
├── client/                         # Angular frontend
│   └── src/
│       ├── app/                    # Root component, config, lazy routes
│       ├── core/                   # Guards, interceptors, layout, pipes, services
│       ├── features/               # Feature routes (account, cooks, orders, admin, etc.)
│       ├── shared/                 # Reusable components, directives, error pages
│       ├── testing/                # Test utilities, mocks, and builders
│       ├── types/                  # TypeScript interfaces and models
│       └── environments/           # Environment configuration
│
├── Khanara.slnx                    # Solution file (API + Tests)
└── README.md
```

## Getting Started

### Prerequisites

- .NET 10.0 SDK
- Node.js 20+ and npm
- Cloudinary account (required — used for user/dish photo uploads)
- Stripe account (optional — UI is currently disabled, but backend webhooks won't work without valid keys)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create your local config from the example:
```bash
copy appsettings.Development.json.example appsettings.Development.json
```

3. Fill in the following in `appsettings.Development.json`:
   - `ConnectionStrings:DefaultConnection` — SQLite database path
   - `TokenKey` — JWT signing key (must be at least 64 characters; startup will fail otherwise)
   - `Jwt:Issuer` and `Jwt:Audience` — JWT token issuer/audience (typically your API and client URLs)
   - `CloudinarySettings` — your Cloudinary credentials (required)
   - `Stripe:SecretKey` and `Stripe:WebhookSecret` — Stripe keys (placeholders are fine while card payments are disabled in the UI)
   - `Cors:AllowedOrigins` — frontend URL (default: `https://localhost:5444`)
   - `DailyReset:CutoverHourUtc` (optional) — hour of the day (0–23, default `3`) when daily dish portions are reset

   Missing Cloudinary or Stripe config will fail fast at startup outside the Test environment.

4. Apply migrations and run:
```bash
dotnet ef database update
dotnet run
```

API available at `https://localhost:7071` — Swagger at `https://localhost:7071/swagger`.

The launch URL is defined in `backend/Properties/launchSettings.json`. On first run, seed users and a sample dish catalog are loaded automatically.

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Update `src/environments/environment.development.ts` with your API and SignalR hub URLs if they differ from the defaults (`https://localhost:7071/api/` and `https://localhost:7071/hubs/`).

4. Start the dev server:
```bash
npm start
```

App available at `https://localhost:5444`.

### Running Tests

**Frontend:**
```bash
cd client
npm test                  # Watch mode
npm run test:ci           # Single run (CI)
npm run test:coverage     # With coverage report
```

**Backend:**
```bash
cd backend/Khanara.API.Tests
dotnet test                          # Run all tests
dotnet test --filter "Category=Unit" # Unit tests only
dotnet test --collect:"XPlat Code Coverage" --settings coverlet.runsettings  # With coverage
```

## API Endpoints

| Prefix | Description |
|---|---|
| `/api/account` | Auth, registration, refresh token rotation, logout |
| `/api/members` | Current user profile and avatar upload |
| `/api/cooks` | Cook profiles, kitchen management, public reviews |
| `/api/dishes` | Dish catalog, photos, and management |
| `/api/orders` | Order placement, tracking, cancellation, in-app messaging |
| `/api/cart` | Shopping cart (add, update, remove, clear, merge guest cart) |
| `/api/favorites` | Saved cooks |
| `/api/reviews` | Review creation and cook replies |
| `/api/discovery` | Near-me, popular, and new cooks |
| `/api/payments` | Stripe checkout session + webhook (UI path currently disabled) |
| `/api/admin` | Admin user and role management |
| `/hubs/order` | SignalR hub for live order status, messages, and presence |

## Background Services

- **AbandonedOrderCleanupService** — Runs every 15 minutes. Cancels Stripe orders that have been stuck in `Pending` for more than 45 minutes, restores their dish portions, and asks Stripe to expire the checkout session.
- **DailyPortionsResetService** — Runs every 30 minutes. Once per day at the configured cutover hour (default `03:00 UTC`, see `DailyReset:CutoverHourUtc`), it resets every dish's `PortionsRemainingToday` back to `PortionsPerBatch` and then deducts portions still locked by active (non-delivered, non-cancelled) orders.

`OrderNotificationService` is **not** a background service — it's a scoped service that centralizes SignalR broadcasts for order status changes and messages, called from controllers.

## Security

- **JWT with refresh token rotation** — access tokens expire in 60 minutes; refresh tokens are hashed (SHA-256) before storage and rotated on each use
- **Role-based authorization** — `Admin`, `Moderator`, `Cook`, `Eater` (new users get `Eater` by default)
- **Rate limiting** — per-IP fixed window on `/api/account/*` endpoints (10 requests/minute by default, configurable via `RateLimiting:AuthPermitLimit`)
- **Account lockout** — 5 failed login attempts → 5-minute lockout
- **Password policy** — 12+ chars, uppercase, lowercase, digit required
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Content-Security-Policy`, `HSTS` (non-dev only)
- **Cookie security** — refresh token stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookie
- **HTTPS** — enforced via `UseHttpsRedirection`
- **Image upload validation** — content-type + magic-byte signature check, 5 MB limit, JPEG/PNG/WebP only
- **Startup validation** — missing `TokenKey`, `CloudinarySettings`, or `Stripe` config fails fast outside the Test environment
- **Global error handling** — `ProblemDetails` response shape (RFC 7807), concurrency conflicts mapped to 409

## Deployment Notes

- **Database**: SQLite is used for development. For production, migrate to PostgreSQL or SQL Server.
- **Migrations**: `Program.cs` currently calls `MigrateAsync()` on startup. If you scale horizontally, move migrations to a CI/CD step so multiple instances don't race.
- **Secrets**: Use environment variables, Azure Key Vault, or AWS Secrets Manager — never commit credentials.
- **Stripe**: When re-enabling card payments in the checkout UI, configure real webhook endpoints for `checkout.session.completed` and `charge.refunded`, and verify the webhook secret matches.
- **Images**: Ensure Cloudinary upload limits and transformations match production expectations.
- **CORS**: Update `Cors:AllowedOrigins` to your production frontend URL.
- **Daily reset cutover**: `DailyReset:CutoverHourUtc` is a platform-wide UTC hour. For multi-timezone markets, plan to migrate this to per-cook timezones on `CookProfile`.

---

*This project is under active development. Card payments, WCAG audit, and a production PostgreSQL migration are on the near-term roadmap.*
