# API Reference

Base URL (development): `https://localhost:7071/api`

Full request/response schemas are available interactively via Swagger at `https://localhost:7071/swagger` while the API is running.

---

## Endpoints

| Route prefix | Description |
|---|---|
| `POST /api/account/register` | Register a new user |
| `POST /api/account/login` | Login, returns JWT access token + sets refresh cookie |
| `POST /api/account/refresh-token` | Rotate refresh token, returns new access token |
| `POST /api/account/logout` | Revoke refresh token, clear cookie |
| `/api/members` | Current user profile and avatar upload |
| `/api/cooks` | Cook profiles, kitchen management, public reviews |
| `/api/dishes` | Dish catalog, photos, CRUD |
| `/api/cart` | Add, update, remove, clear, merge guest cart |
| `/api/orders` | Place, track, cancel orders; in-order messaging |
| `/api/favorites` | Save and unsave cooks |
| `/api/reviews` | Create reviews, cook replies |
| `/api/discovery` | Near-me, popular, and new cooks |
| `/api/payments` | Stripe checkout session creation and webhook handler |
| `/api/admin` | User listing and role management (Admin only) |
| `wss://.../hubs/order` | SignalR hub — live order status, messages, and presence |

---

## Authentication

All protected routes require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The SignalR hub accepts the token via query string: `?access_token=<token>`.

Access tokens expire after **60 minutes**. Use `POST /api/account/refresh-token` to get a new one — the refresh token is stored in an `HttpOnly` cookie and rotated on every use.

---

## Roles

| Role | Access |
|---|---|
| `Eater` | Default for new users. Can browse, order, review, favorite. |
| `Cook` | All Eater permissions plus cook dashboard, dish and order management. |
| `Moderator` | Can moderate photos and content. |
| `Admin` | Full access including user and role management. |

---

## Pagination

List endpoints accept `pageNumber` and `pageSize` query params and return a `PaginatedResult<T>` with:

```json
{
  "items": [...],
  "totalCount": 42,
  "pageSize": 10,
  "currentPage": 1,
  "totalPages": 5
}
```

---

## Error Responses

All errors follow [RFC 7807 ProblemDetails](https://www.rfc-editor.org/rfc/rfc7807):

```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Bad Request",
  "status": 400,
  "errors": { "field": ["Validation message"] }
}
```

Concurrency conflicts return HTTP **409**. Rate limit exceeded returns HTTP **429**.
