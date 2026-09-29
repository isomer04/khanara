# Khanara

**🌐 Moving to Google Cloud: [https://khanara.shop](https://khanara.shop)** — Cloud Run + Cloud SQL, provisioned with Terraform ([plan](docs/gcp-deployment-plan.md)). The previous Azure deployment went offline when the free tier expired. See the [demo gif](assets/khanara.gif) below.

A home-cooked food marketplace connecting home cooks with food enthusiasts, specializing in Asian and Arabian cuisines.

[![CI/CD](https://github.com/isomer04/khanara/actions/workflows/ci.yml/badge.svg)](https://github.com/isomer04/khanara/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-EF_Core_10-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-Cloud_Run-4285F4?logo=googlecloud&logoColor=white)](docs/gcp-deployment-plan.md)
[![Terraform](https://img.shields.io/badge/Terraform-IaC-844FBA?logo=terraform&logoColor=white)](infra/terraform)
[![Stripe](https://img.shields.io/badge/Stripe-51-635BFF?logo=stripe&logoColor=white)](https://stripe.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-images-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com/)

### Demo

While the live site is down, here's a walkthrough of the app:

![Khanara demo](assets/khanara.gif)

---

## What is Khanara?

Khanara lets home cooks list their dishes, set daily portions, and receive orders — while customers browse authentic home-cooked meals nearby, track their order in real time, and chat directly with cooks.

---

## Features

- **Browse & discover** dishes by cuisine, dietary tags, and cook rating
- **Real-time order tracking** with live status updates via SignalR
- **In-app messaging** between customers and cooks per order
- **Daily portion control** — automatic inventory with per-batch limits
- **Cook profiles** with kitchen photos, service zones, and availability toggle
- **Reviews & ratings** with cook replies
- **Favorites** and multi-item cart (with guest-to-auth merge)
- **Admin panel** for user, role, and content moderation
- **Role-based access** — `Eater`, `Cook`, `Moderator`, `Admin`

---

## Quick Start

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 24 (LTS)](https://nodejs.org/)
- [Docker](https://www.docker.com/) (runs the PostgreSQL database)
- [Cloudinary account](https://cloudinary.com/) (required for photo uploads)

### Database

PostgreSQL runs in Docker. Set a password and start the container:

```bash
# Create a .env file in the repo root (docker-compose.yml reads it; it is gitignored)
echo POSTGRES_PASSWORD=YourStrong!Passw0rd > .env
docker compose up -d
```

PostgreSQL listens on `localhost:5433`.

### Backend

```bash
cd backend
copy appsettings.Development.json.example appsettings.Development.json
# Fill in the Postgres password, TokenKey (64+ chars), Cloudinary, Stripe, and CORS values
dotnet ef database update
dotnet run
```

API: `https://localhost:7071` · Swagger: `https://localhost:7071/swagger`

### Frontend

```bash
cd client
npm install
npm start
```

App: `https://localhost:5444`

### Tests

```bash
# Frontend
cd client && npm run test:ci

# Backend
cd backend/Khanara.API.Tests && dotnet test
```

---

## Deployment

**Target: Google Cloud at [khanara.shop](https://khanara.shop).** One Cloud Run container (API + SPA) that scales to zero, Cloud SQL for PostgreSQL, Secret Manager, Cloud Scheduler for the background jobs, and Cloud DNS. All of it is defined in Terraform under [`infra/terraform/`](infra/terraform). It costs about $10–15/month, so the $300 free-trial credit covers the whole trial. See the [GCP deployment plan](docs/gcp-deployment-plan.md) for the architecture, costs and runbook.

When CI passes on `main`, [`deploy-gcp.yml`](.github/workflows/deploy-gcp.yml) builds the Docker image, pushes it to Artifact Registry and rolls out a new revision. It authenticates through **Workload Identity Federation**, so no service-account keys are stored. See [docs/deployment.md](docs/deployment.md) for environment variables, Stripe webhooks and the security checklist.

The app **has been deployed before** on Azure App Service with Azure SQL. See the [@docs/screenshots/](docs/screenshots/) folder for proof: the Azure overview (healthy web app on Linux/.NET 10), the Deployment Center activity log and GitHub Actions CI/CD runs.

### Past deployments (screenshots)

| | |
|---|---|
| ![Azure App Service overview — web app healthy and running on .NET 10](docs/screenshots/image-1.png) | ![Azure Deployment Center — successful deployments by isomer04](docs/screenshots/image-2.png) |
| **Azure App Service overview** — khanara web app, Linux, .NET 10, last deploy June 10, 2026 | **Azure Deployment Center** — push and OneDeploy history, all succeeded |

![GitHub Actions — CI/CD pipeline runs for khanara](docs/screenshots/image-3.png)

---

## Documentation

| Guide | Description |
|---|---|
| [docs/configuration.md](docs/configuration.md) | All config keys, environment variables, and secrets |
| [docs/api-reference.md](docs/api-reference.md) | Endpoint reference, auth, roles, pagination, error shapes |
| [docs/architecture.md](docs/architecture.md) | System diagram, layer structure, auth flow, domain entities |
| [docs/gcp-deployment-plan.md](docs/gcp-deployment-plan.md) | Google Cloud architecture, costs, Terraform layout, first-time runbook |
| [docs/deployment.md](docs/deployment.md) | Production build, database migration, Stripe webhooks, security checklist |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Branching, commit style, PR guidelines, code standards |

---

## Project Structure

```
khanara/
├── .github/workflows/    # CI: build, test, lint, Trivy scan
├── backend/              # ASP.NET Core API (Controllers, Data, Services, SignalR)
│   └── Khanara.API.Tests/# xUnit tests (unit, integration, concurrency)
├── client/               # Angular SPA (features, core, shared, types)
├── docs/                 # Guides: config, API, architecture, deployment, contributing
├── infra/terraform/      # GCP infrastructure (bootstrap + prod stacks)
├── Dockerfile            # Angular build → .NET publish → runtime image
├── LICENSE
└── README.md
```

---

## Contributing

Read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) before opening a PR.

---

## License

[MIT](LICENSE)
