# Custom Domain Setup (khanara.shop)

How to serve the Cloud Run app at `https://khanara.shop` while everything stays billed to the personal GCP account (`rashedkhanmanan@gmail.com`). The khanara.shop Cloud Identity account is only used to prove domain ownership; it pays for nothing.

## Why this works

- The domain and the GCP billing account are independent. Cloud Run only requires that the account creating the domain mapping is an **owner of the domain in Google Search Console**.
- A domain can have **multiple owners**, all with the same rights. Adding the personal Gmail account as an owner doesn't remove the khanara.shop account.
- The project `khanara-prod-917585` is already billed to the personal account's billing account, and the app is already live on its `run.app` URL.

### Two kinds of owner

| Type | How you get it | Notes |
|---|---|---|
| **Verified owner** | Add your own `google-site-verification` TXT record at the registrar | A domain can hold several of these TXT records side by side, one per account. Doesn't depend on any other account |
| **Delegated owner** | An existing owner adds you in Search Console | No DNS change. Ownership is lost if the owner who added you stops being verified |

Cloud Run accepts either.

## Current state

| Item | Status |
|---|---|
| Active gcloud account | `rashedkhanmanan@gmail.com` |
| GCP project | `khanara-prod-917585` (under the khanara.shop organization, billed to the personal billing account) |
| App URL today | the default `run.app` URL (`terraform output service_url`) |
| Domain owner for the personal account | **No.** `gcloud domains list-user-verified` returns nothing |
| Nameservers | Hostinger (`atlas.dns-parking.com`, `hyperion.dns-parking.com`) |
| Existing apex TXT | the khanara.shop account's `google-site-verification=…` record. **Keep this** |
| `enable_domain_mapping` | `false` |

## Step 1: Make the personal account an owner of khanara.shop

Pick **one** option.

### Option A: Delegated owner (quickest, no DNS change)

1. Open [Google Search Console](https://search.google.com/search-console) signed in as the **khanara.shop admin** account.
2. Select the `khanara.shop` property.
3. Go to **Settings → Users and permissions → Add user**.
4. Enter `rashedkhanmanan@gmail.com` and set the permission to **Owner**.

Alternatively, use the [verification page](https://www.google.com/webmasters/verification/): open `khanara.shop`, then **Add an owner**.

### Option B: Verified owner (more robust)

1. Signed in as `rashedkhanmanan@gmail.com`, run:

   ```bash
   gcloud domains verify khanara.shop
   ```

2. Search Console opens. Choose the **Domain** property type and copy the TXT record it gives you.
3. In Hostinger DNS, **add** it as a new TXT record on the apex (`@`). Don't replace the existing `google-site-verification` record; keep both.
4. Wait a few minutes, then click **Verify** in Search Console.

### Check

```bash
gcloud domains list-user-verified   # must list khanara.shop
```

> If Terraform ever runs as a service account instead of your user, add that service account as an owner too (Option A, using its email).

## Step 2: Turn on the domain mapping

1. In `infra/terraform/prod/terraform.tfvars`, set:

   ```hcl
   enable_domain_mapping = true
   ```

2. Plan and apply as `rashedkhanmanan@gmail.com`:

   ```bash
   cd infra/terraform/prod
   terraform plan
   terraform apply
   ```

   This creates the Cloud Run domain mappings for `khanara.shop` and `www.khanara.shop`. It also switches `Stripe__SuccessUrl` and `Stripe__CancelUrl` from the `run.app` URL to `https://khanara.shop` (see `local.public_url` in `main.tf`), which rolls out a new Cloud Run revision.

> The Stripe redirect URLs point at the domain as soon as this is applied. Do Step 3 right after, so checkout doesn't send customers to a domain that doesn't resolve yet.

## Step 3: Point DNS at Cloud Run

Pick **one** option.

### Option A: Move DNS to Cloud DNS (managed by Terraform)

1. **Before switching**, write down every record Hostinger serves today:

   ```bash
   nslookup -type=TXT khanara.shop 8.8.8.8
   nslookup -type=MX  khanara.shop 8.8.8.8
   nslookup -type=CNAME www.khanara.shop 8.8.8.8
   ```

2. Copy the ones you need into `terraform.tfvars` (`apex_txt_records`, `mx_records`). Include **all** `google-site-verification` TXT values, or the domain stops being verified. Apply again.
3. Get the Cloud DNS nameservers:

   ```bash
   terraform output dns_name_servers
   ```

4. In Hostinger, change the domain's nameservers to those four values.
5. Wait for propagation:

   ```bash
   nslookup -type=NS khanara.shop 8.8.8.8
   ```

### Option B: Keep DNS at Hostinger

Add these records in Hostinger DNS (remove any conflicting parking A/AAAA/CNAME records first):

| Type | Name | Value |
|---|---|---|
| A | `@` | `216.239.32.21` |
| A | `@` | `216.239.34.21` |
| A | `@` | `216.239.36.21` |
| A | `@` | `216.239.38.21` |
| AAAA | `@` | `2001:4860:4802:32::15` |
| AAAA | `@` | `2001:4860:4802:34::15` |
| AAAA | `@` | `2001:4860:4802:36::15` |
| AAAA | `@` | `2001:4860:4802:38::15` |
| CNAME | `www` | `ghs.googlehosted.com.` |

Compare these with the `domain_mapping_records` Terraform output after apply. Keep every existing TXT and MX record.

With this option the Terraform Cloud DNS zone exists but isn't used. It costs about $0.20/month; you can leave it or remove it later.

## Step 4: Wait for the certificate

Cloud Run issues a Google-managed TLS certificate once DNS points at it. This usually takes 15–60 minutes and can take up to 24 hours.

```bash
gcloud beta run domain-mappings describe --domain khanara.shop --region us-central1
gcloud beta run domain-mappings describe --domain www.khanara.shop --region us-central1
```

Wait until the `CertificateProvisioned` and `Ready` conditions are `True`.

## Step 5: Update Stripe

In the Stripe dashboard, make sure the webhook endpoint is:

```
https://khanara.shop/api/payments/webhook
```

with the events `checkout.session.completed` and `charge.refunded`. If you create a new endpoint, put its new signing secret into Secret Manager and roll out a new revision.

## Step 6: Verify

- [ ] `gcloud domains list-user-verified` lists `khanara.shop`
- [ ] `curl -sI https://khanara.shop/health` returns `200` and a `strict-transport-security` header
- [ ] `https://www.khanara.shop` loads (or redirects to `https://khanara.shop`)
- [ ] Log in, place a test order and complete Stripe checkout; you land back on `https://khanara.shop/payment/success`
- [ ] `curl -X POST https://khanara.shop/api/jobs/daily-portions-reset` returns `401`
- [ ] Search Console still shows the domain as verified for the khanara.shop account

## Rules to keep

- **Never delete** any `google-site-verification` TXT record, or the matching account loses ownership. With a delegated owner (Step 1, Option A), losing the khanara.shop account's record also removes your ownership.
- **Don't delete** the khanara.shop Cloud Identity account. The GCP project sits under its organization, so deleting it can cost you admin control of the project.
- All Cloud Run, Cloud SQL and DNS costs stay on the personal billing account.

## Rollback

To go back to the `run.app` URL, set `enable_domain_mapping = false` and apply again. This removes the mappings and points the Stripe URLs back at `run.app`. DNS records can stay in place.
