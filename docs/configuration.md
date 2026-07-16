# Configuration Reference

All configuration lives in `backend/appsettings.Development.json` (gitignored).
Copy the example to get started:

```bash
copy backend/appsettings.Development.json.example backend/appsettings.Development.json
```

---

## Required Keys

### Database

| Key | Example | Notes |
|---|---|---|
| `ConnectionStrings:DefaultConnection` | `Server=localhost,1434;Database=khanara;User Id=sa;Password=…;TrustServerCertificate=True` | SQL Server connection string. The dev database runs in Docker (`docker compose up -d`) on port 1434; the password is whatever you set as `SQL_SA_PASSWORD` |

### JWT / Auth

| Key | Example | Notes |
|---|---|---|
| `TokenKey` | `<random 64+ char string>` | **Minimum 64 characters** — startup fails otherwise |
| `Jwt:Issuer` | `https://localhost:7071` | Should match the API base URL |
| `Jwt:Audience` | `https://localhost:5444` | Should match the frontend URL |

Access tokens expire after 60 minutes. Refresh tokens are SHA-256 hashed before storage and rotated on every use.

### Cloudinary (required)

| Key | Where to find it |
|---|---|
| `CloudinarySettings:CloudName` | Cloudinary dashboard → Account Details |
| `CloudinarySettings:ApiKey` | Cloudinary dashboard → API Keys |
| `CloudinarySettings:ApiSecret` | Cloudinary dashboard → API Keys |

Missing Cloudinary config causes a fast-fail on startup outside the Test environment.

### Stripe

| Key | Example | Notes |
|---|---|---|
| `Stripe:SecretKey` | `sk_test_…` | Test key from Stripe dashboard |
| `Stripe:WebhookSecret` | `whsec_…` | From `stripe listen` CLI or Stripe dashboard |
| `Stripe:SuccessUrl` | `https://localhost:5444/payment/success?orderId={0}` | Redirect after successful payment |
| `Stripe:CancelUrl` | `https://localhost:5444/orders/{0}` | Redirect after cancelled payment |

> Card payments are wired up in the backend but the frontend UI path is currently disabled. Placeholder values work while testing other features.

### CORS

| Key | Example |
|---|---|
| `Cors:AllowedOrigins` | `["https://localhost:5444"]` |

### Optional

| Key | Default | Notes |
|---|---|---|
| `DailyReset:CutoverHourUtc` | `3` | UTC hour (0–23) when daily dish portions reset |
| `RateLimiting:AuthPermitLimit` | `10` | Requests per minute per IP on `/api/account/*` |

---

## Frontend Environment

Edit `client/src/environments/environment.development.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'https://localhost:7071/api/',
  hubUrl: 'https://localhost:7071/hubs/'
};
```

---

## Security Notes

- Never commit `appsettings.Development.json` or `.env` (holds `SQL_SA_PASSWORD`) — both are gitignored.
- For production, inject secrets via environment variables, Azure Key Vault, or AWS Secrets Manager.
- SSL certificates (`*.pem`, `*.key`) are gitignored. Generate them locally with `mkcert` or the .NET dev cert tool.
