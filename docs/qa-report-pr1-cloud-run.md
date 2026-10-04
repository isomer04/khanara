# QA Report: PR #1 (GCP / Cloud Run deployment), live app

| | |
|---|---|
| **PR** | [#1 feat(infra): deploy to Google Cloud with Terraform](https://github.com/isomer04/khanara/pull/1) (branch `infra/gcp-terraform`, open) |
| **Target** | https://khanara-940992710588.us-central1.run.app (Cloud Run, not local) |
| **Deployed build** | revision `khanara-00003-jgp`, image tag `493b1f4` (created 2026-09-29 03:25 UTC) |
| **Date** | 2026-09-30, ~18:49–19:10 UTC |
| **Method** | Playwright MCP (Chromium, desktop 1280×800 + mobile 375×812), in-page `fetch` probes for API checks, `curl` for headers, read-only `gcloud` for logs/revision/scheduler |
| **Accounts used** | New eater `qa.eater.4302873@example.com` (created during the test); seed cook `indiancook@khanara.seed` (Spice Route Kitchen) |

---

## TL;DR

The deployment is up and the core catalog, auth, ordering, cancellation and authorization rules work. But:

1. **The live revision is 5 commits behind the PR.** `493b1f4` is deployed. `93c3f12`, `9d15156`, `cf86bb0`, `e5d24e3` and `92e4465` are not, so the SignalR fix, both webhook fixes and the secret rotation have **not** been verified live.
2. **Stripe and Cloudinary secrets are still `REPLACE_ME`** in production. Card checkout returns 500, and photo uploads fail with the raw message `Unknown API key REPLACE_ME`.
3. **Real-time is broken on the deployed build.** The order hub `JoinOrder` race throws on every order and chat page. Status changes and chat messages never show up live.
4. **Delivered orders are unreachable.** Order detail → `GET /api/reviews/order/{id}` → 404 (no review yet) → global interceptor redirects to `/not-found`. As a result, **eaters can't leave reviews through the UI at all**.
5. **The seed cook password committed to the public repo works in production** (already called out in the PR, now confirmed live).

---

## Findings

Severity: 🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low. "PR" = caused by or specific to this PR/deployment; "Pre-existing" = app bug present before this PR, found while testing.

### 🔴 Critical

#### C1. Production Stripe and Cloudinary keys are placeholders (PR / deployment)
- **Steps:** Create a Stripe order (`POST /api/orders` with `paymentMethod: 1`), then `POST /api/payments/checkout-session {orderId}`.
- **Actual:** `500 Internal Server Error`. Cloud Run log: `Stripe.StripeException: Invalid API Key provided: REPLACE_ME` at `StripeService.CreateCheckoutSessionAsync` (`StripeService.cs:43`).
- **Also:** Dish photo upload returns `400 Unknown API key REPLACE_ME`, and that text is shown to the user in a toast.
- **Expected:** Runbook step 4 (`gcloud secrets versions add` for Stripe/Cloudinary) done before calling the site live.
- **Notes:** The PR's main behavior changes (webhook idempotency, late-payment refund, cleanup expiring Checkout Sessions) can't be exercised end-to-end until real Stripe test keys are in place.

#### C2. Deployed revision doesn't contain the latest PR commits (PR / deployment)
- `gcloud run services describe` → image `khanara:493b1f4`, revision `00003` from 2026-09-29 03:25. The branch HEAD is `ae4e8e5`.
- Not live: `93c3f12` (cleanup vs webhook race), `cf86bb0` (hub start before join), `e5d24e3` (webhook commit with idempotency marker), `92e4465` (rotated secrets + Stripe URLs).
- The browser stack trace confirms this: `joinOrder → invoke` runs synchronously with no `OrderHub error:` wrapper, which is the pre-`cf86bb0` code.
- **Action:** Redeploy from the branch (or merge → `deploy-gcp.yml`) and re-run this checklist.

#### C3. Committed seed-cook password works on production (PR notes it; confirmed live)
- `POST /api/account/login` as `indiancook@khanara.seed` with the password in `backend/Data/Seed.cs` → **200**. The account has the Cook role and can change order statuses for Spice Route Kitchen. The same applies to all 10 `*cook@khanara.seed` accounts.
- **Action:** Rotate those passwords in the live DB now, and gate the catalog seeding behind config.

### 🟠 High

#### H1. Real-time updates don't work: status changes and chat never show live (PR area; fix not deployed)
- **Steps:** Eater opens `/orders/1`. In a second browser, the cook clicks *Mark as Accepted → Preparing → Ready → Delivered* (all `PUT …/status` → 200).
- **Actual:** The eater page stays on **Pending** through all 4 transitions. Console on every order/chat page load: `Error: Cannot send data if the connection is not in the 'Connected' State. at joinOrder`.
- **Chat:** Sending a message → `POST /api/orders/1/messages` → **201**, but the message **never appears** in the sender's own chat. It only shows after a full page reload. Reproduced 4/4 times, including after a reload.
- Expected to be fixed by `cf86bb0`, but that commit isn't deployed (C2). **Re-test after redeploy.**

#### H2. Delivered order pages redirect to "Not found", so the review UI can't be reached (Pre-existing)
- **Steps:** Cook marks order #1 **Delivered**. Eater (or cook) opens `/orders/1`.
- **Actual:** `GET /api/orders/1` → 200, then `GET /api/reviews/order/1` → **404** (no review yet). `error-interceptor.ts:36` sends every 404 to `/not-found`, so the whole page is replaced by "Not found". This happens for both the eater and the cook.
- **Impact:** The "leave a review" form lives on this page, so **eaters can never review through the UI**, and cook ratings stay at 0 forever. I had to post a review via the API to test the reviews display.
- **Fix idea:** Return `200 null` / `204` from `GetReviewByOrder` when there's no review, or have the interceptor skip this request (e.g. an `HttpContext` token).

#### H3. Dish form gets stuck on a spinner after any server validation error (Pre-existing)
- **Steps:** *My Kitchen → + Add dish*, then either click *Create dish* with an empty form, or enter price `-5` / portions `0`.
- **Actual:** `POST /api/dishes` → 400, and the form is replaced by an endless spinner. All input is lost and only a reload recovers.
- **Cause:** `dish-form.ts` `submit()` resets `loading` only in `complete`, and RxJS never calls `complete` after `error`. The template hides the form with `@if (loading() && !isEditMode())`. There's also no client-side validation, so this path is easy to hit.

#### H4. "Click to upload" photo picker does nothing (Pre-existing)
- **Steps:** Dish edit → *Photos* → click *Click to upload or drag and drop* → choose a file in the OS picker.
- **Actual:** Nothing happens: no preview and no *Upload image* button. Drag-and-drop does work.
- **Cause:** `shared/image-upload/image-upload.html`: `<input type="file" id="dropzone-file">` has no `(change)` handler, and there's no `accept` attribute. This probably affects the profile photo upload too, since it's the same component.

#### H5. Choosing "Delivery" never asks for an address (Pre-existing)
- **Steps:** Checkout → *Delivery* → *Place order*.
- **Actual:** Order created (`fulfillmentType: 1`). The only visible fields are the fulfillment radios, notes, and payment method. Neither the eater's nor the cook's order page shows any address. The eater's location is never checked against the cook's service zip codes either.
- **Impact:** The cook can't actually deliver.

### 🟡 Medium

| # | Finding | Evidence | Origin |
|---|---|---|---|
| M1 | **Sign-up step 2: first click on "Create account" is swallowed.** DOB/City/Country use `updateOn: 'blur'`, so the button is still disabled while the last field is focused. The mousedown blurs the field and enables the button, but the click has already landed on a disabled button. | Real mouse click: 0 requests to `/api/account/register`, then the button becomes enabled. A second click works. | Pre-existing |
| M2 | **Adding a dish from a second cook silently empties the cart.** The only notice is a toast after the fact; there's no confirm. | Cart went 3 items ($48) → 1 item. | Pre-existing |
| M3 | **New cook's dashboard is broken until reload.** After *Open my kitchen*, `GET /api/cooks/me` → **403** because the access token lacks the new Cook role. The dashboard is blank with "Something unexpected went wrong". A reload (token refresh) fixes it. | Console + network | Pre-existing |
| M4 | **Service zip codes aren't validated** (client or server). `abc, 123, 1000100` were saved as-is. | `POST /api/cooks` 201 with `serviceZipCodes: ["abc","123","1000100"]` | Pre-existing |
| M5 | **Delete dish has no confirmation.** A single click on *Delete* sends `DELETE /api/dishes/{id}` → 204. | `cook-dashboard.html:47` | Pre-existing |
| M6 | **Unknown `/api/*` routes return the SPA's `index.html` with 200.** For example `/api/doesnotexist` → 200 HTML. As a result `/cooks/abc` (the `:int` route constraint misses) makes the client parse HTML as JSON: blank page + "Something unexpected went wrong". | `curl`/fetch | Pre-existing, but worth fixing with the new hosting |
| M7 | **Static assets are served uncompressed and without long-lived caching.** No `Content-Encoding` on any bundle (largest JS chunk 167 KB, CSS 118 KB raw), and hashed files come with `Cache-Control: private`. Cloud Run doesn't compress for you. | `curl -H 'Accept-Encoding: gzip, br'` | **PR** (new hosting). Add `UseResponseCompression` or precompressed assets, and `immutable` for hashed files |
| M8 | **Card payment says "Coming soon" in the UI, but the API accepts Stripe orders.** An API-created Stripe order sits in Pending/Unpaid until the cleanup job cancels it. | `POST /api/orders` with `paymentMethod: 1` → 201 | Pre-existing / PR context |
| M9 | **Home-page cuisine chips don't filter.** All 11 chips (Bengali, Indian…) are `routerLink="/cooks"` with no query param. | `home.html:56-64` | Pre-existing |

### 🔵 Low

- **Auth guard UX:** Anonymous deep links to `/orders`, `/admin` and `/cook/dashboard` redirect to `/` with the toast "You shall not pass". There's no login prompt and no return URL. Anonymous *+ Add to order* also silently navigates to `/` with no message.
- **Login error toast** says "Unauthorized" instead of the server's "Invalid credentials".
- **Other user's profile URL** (`/members/{otherId}`) renders an empty "Edit profile" form (API correctly returns 403) instead of an error or redirect.
- **Browse filters aren't in the URL:** cuisine/zip filters are lost on reload/back and can't be shared. Non-numeric zips (`12ab`) are sent to the API. Copy says "1 cooks available in your area" (plural) and "10 cooks available in your area" with no location set.
- **Signed-in SignalR URL is logged to the console** at Information level, including `access_token=<JWT>` in the query string (`Information: WebSocket connected to wss://…?access_token=eyJ…`). Lower the SignalR client log level in production. Cloud Run request logs will also capture the token in the query string.
- **A11y:** Dish form inputs and onboarding inputs have no associated `<label>`s (placeholder only). The cart badge's accessible name is just "3". Registration email field is `type="text"`.
- **Gender** has only Male/Female. Consider optional/other.
- **Duplicate email sign-up** returns the raw Identity message `Username '…' is already taken` (and allows account enumeration, which is common and low risk).
- **Anonymous page load** always logs a `401` for `/api/account/refresh-token` in the console (expected but noisy).
- **Docs drift:** The PR description still says `/healthz` (code and plan now use `/health`; `/healthz` returns Google's 404). The PR says the app moves "to `https://khanara.shop`", but `khanara.shop` and `www` still serve a **Hostinger parking page**. The README correctly says "coming soon".

---

## What passed ✅

| Area | Result |
|---|---|
| Cold start / health | `/health` → 200 `Healthy`. SPA "Initializing…" splash ≈ 0.9 s warm |
| Catalog | 10 cooks / 102 dishes seeded, all images load (0 broken), cook detail, menu, portions left, dietary badges |
| Browse filters | Cuisine filter (Bengali → 1, Nepali → empty state with *Clear filter*), zip `10001` → 2 cooks, `99999` → empty state |
| Registration validation | Required, email format, display name ≥ 2, password ≥ 12 + upper/lower/digit, confirm match, DOB ≥ 13 years |
| Auth / session | Register auto-logs in. Access token kept in memory only (localStorage empty). `refreshToken` cookie is `HttpOnly; Secure; SameSite=Strict`, 60 days. Session survives reload. Logout clears the cookie and refresh → 401 |
| Brute force | Login rate limit: 8 × 401 then 429 |
| Favorites | Add → 201, heart toggles, `/favorites` lists them |
| Cart | Totals correct ($18×2 + $12 = $48), survives reload |
| Ordering | Cash/pickup and cash/delivery orders → 201. Portions decrement (Samosa 20 → 17) and are restored on cancel (→ 20) |
| Cancellation | Requires a non-blank reason. Only allowed while Pending (400 on a delivered order) |
| Cook workflow | Incoming orders list. Pending → Accepted → Preparing → Ready → Delivered all 200 |
| Onboarding / dish CRUD | Become a Cook → kitchen created. Create / edit (price 9.99 → 11.50) / delete dish all work |
| Profile | Rename saves and updates the menu. Empty name disables Save |
| Reviews API / display | Rating 6 → 400. Duplicate → 400. Review of an undelivered order → 400. Review shows on the cook page with rating 4.0 · 1 review |
| XSS | `<img onerror>` in order notes and `<script>` in a review/chat are rendered as text; no dialog fired |
| AuthZ (API) | Eater → cook status change 403, `/api/orders/cook` 403, `/api/admin/*` 403, other member 403. Anonymous → 401. Dish from another cook → 400. Qty 0 / −5 / 999 / empty items / bad enums → 400 |
| Jobs | `/api/jobs/*` → 401 anonymous **and** with an app-user JWT. Cloud Scheduler: `abandoned-order-cleanup` (*/15) last attempt 19:00:11 OK, `daily-portions-reset` (03:00) last attempt 03:00 OK |
| Webhook | Unsigned `POST /api/payments/webhook` → 400 "Missing Stripe-Signature header" |
| Security headers | HSTS, CSP (`script-src 'self'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`. No CORS headers for a foreign origin |
| Theme | Dark theme applies and persists across reload |
| Mobile (375 px) | No horizontal overflow on `/`, `/cooks`, `/cooks/1`, `/register`. Hamburger menu present |

## Not tested / blocked

- **Stripe Checkout → webhook → paid / refund-after-cancel**: blocked by C1.
- **Photo upload success path** (dish and profile): blocked by C1.
- **Abandoned-order cleanup on a real order**: order #3 (Stripe, unpaid, created ~19:00 UTC) should be auto-cancelled by the scheduler at the first run after ~19:45 UTC. Check `/orders/3` or the Cloud Run logs to confirm.
- **Admin / moderator UI**: those accounts aren't seeded on the fresh DB (per the PR), so not tested.
- **Custom domain** `khanara.shop`: not connected yet.

## Test data left in production

Clean up if you want a pristine catalog:

- User `qa.eater.4302873@example.com` (display name "QA Eater Renamed"), which is now also a cook: **cook profile #11 "QA Test Kitchen"** (Bengali, bad zips `abc, 123, 1000100`, visible in Browse).
- Orders **#1** (Delivered, Spice Route Kitchen, with 4 chat messages), **#2** (Cancelled), **#3** (Stripe, pending → will be auto-cancelled).
- **Review #1** (4★) on order #1. **Spice Route Kitchen now publicly shows 4.0 · 1 review.**
- Favorites: cooks #1 and #3 for the QA user.
- Dish #103 was created and then deleted.

## Suggested next steps

1. Add real Stripe **test** keys and Cloudinary keys to Secret Manager, redeploy the branch head, then re-run H1 plus the Stripe flow (checkout → webhook → Paid; cancel → late payment → refund).
2. Rotate the 10 seed-cook passwords in the live DB (C3).
3. Fix H2 (review 404 → not-found) and H3/H4 (dish form spinner, file picker). These are small changes that block core flows.
4. Enable response compression and immutable caching for hashed assets (M7).
5. Update the PR description (`/healthz` → `/health`, custom domain still pending).
