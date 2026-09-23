# POMS Fashion storefront

Astro + Tailwind CSS static store, with Decap CMS at `/admin/` for managing products
and Paystack / Flutterwave checkout through two small Netlify Functions.

## How it fits together

```
Store owner ──> /admin/ (Decap CMS) ──saves──> GitHub repo
                                               ├─ src/content/products/<name>.md   ← one file per product
                                               └─ public/uploads/<photo>.jpg        ← uploaded photos
GitHub repo ──triggers──> Netlify build (~1 min) ──> live site + /products.json

Shopper: product page → bag (stored in their browser) → /checkout/
   → netlify/functions/checkout.mjs  re-prices the bag from /products.json, starts payment
   → Paystack or Flutterwave hosted payment page
   → /order/success/ → netlify/functions/verify.mjs confirms with the provider → bag cleared
```

Prices are never taken from the shopper's browser. The checkout function looks up every
item in the published catalog, rejects sold-out sizes, adds the delivery fee, and only then
asks Paystack/Flutterwave for a payment link.

## A product file

```md
---
title: Ada wrap dress
price: 48000                 # whole naira
compare_at_price: 55000      # optional, shows as a sale
category: Dresses
images:
  - /uploads/ada-wrap-dress.jpg
  - /uploads/ada-wrap-dress-2.jpg
sizes:
  - { size: S, in_stock: true }
  - { size: L, in_stock: false }
featured: true               # shows in the homepage hero
published: true              # false hides it without deleting
date: 2026-09-10
---
Description in Markdown.
```

The schema is enforced in `src/content.config.ts`, so a bad edit fails the build
(and the live site stays on the last good version) instead of breaking a page.

## Deploy (no terminal needed)

1. **GitHub:** create a new private repository. Click **Add file > Upload files**, open the
   unzipped `poms-fashion` folder, select everything inside it, and drag it onto the page.
   Commit to `main`.
2. **Netlify:** Add new site > Import an existing project > GitHub > pick the repo.
   The build settings are read from `netlify.toml` automatically. Deploy.
3. **Environment variables** (Site configuration > Environment variables), then redeploy:

   | Variable | Value |
   |---|---|
   | `PAYSTACK_SECRET_KEY` | Paystack dashboard > Settings > API Keys (`sk_test_…` first, `sk_live_…` at launch) |
   | `FLW_SECRET_KEY` | Flutterwave dashboard > Settings > API Keys |
   | `PUBLIC_PAYMENT_PROVIDERS` | `paystack`, `flutterwave`, or `paystack,flutterwave` to let shoppers choose |
   | `PUBLIC_DELIVERY_FEE` | Flat fee in naira, e.g. `3500`. `0` for free delivery |
   | `PUBLIC_FREE_DELIVERY_OVER` | Subtotal in naira that unlocks free delivery, e.g. `100000`. `0` turns it off. Drives the progress bar in the bag |

   Only add the key for a provider you list in `PUBLIC_PAYMENT_PROVIDERS`.
4. **Turn on the CMS login:**
   - Site configuration > Identity > **Enable Identity**
   - Registration: set to **Invite only**
   - Identity > Services > **Enable Git Gateway**
   - Identity > **Invite users** > enter the client's email. They click the email link,
     set a password, and land in `/admin/`.
5. **Domain:** replace `pomsfashion.netlify.app` in `astro.config.mjs` and
   `public/admin/config.yml` with the real domain.

If Netlify Identity isn't offered on the account, change `backend` in
`public/admin/config.yml` to `name: github` with `repo: <owner>/<repo>`, and add
a GitHub OAuth app under Netlify's Access control > OAuth. The client then logs in
with a GitHub account that has access to the repo.

## What the client can edit in /admin/

- **Products**: name, price, sale price, short description, photo label (New arrival, Bestseller…), category, photos, sizes with stock, size and fit notes, full description.
- **Store settings > Homepage and store info** (saved to `src/data/home.json`): announcement bar, hero photo and headline, the three category tiles, the sale tile, the four-product curated row, the reassurance lines under Add to bag, WhatsApp/Instagram/email, and the delivery and returns policy.

The sale page (`/shop/sale/`) lists every product that has an original price filled in.

## Logos

`src/icons/wordmark.svg` (header and footer) and `src/icons/mark.svg` are vector traces of
the supplied JPEG logos, coloured with CSS. If the original vector files (.ai, .svg, .pdf) are
available, replace these two files with them for the sharpest result. `public/favicon.svg`
is the mark on white.

## Before launch

- Replace the sample products and placeholder images in `public/uploads/`.
- Fill in the WhatsApp number, Instagram, email and delivery policy under Store settings.
- Categories live in `public/admin/config.yml` (the `Category` select). Add or rename
  them there; the shop navigation builds itself from whatever categories have products.
- Do one test order with each provider using test keys, then swap to live keys.

## Where orders show up

Every paid order appears in the Paystack or Flutterwave dashboard with the customer's
name, phone, delivery address, items and note attached to the transaction. To also get
an email or WhatsApp alert per order, point the provider's webhook at an n8n/Make
workflow (Paystack: `charge.success`; Flutterwave: `charge.completed`).

## Editing code locally (optional)

`npm install`, then `npm run dev` for the site. To test the payment functions locally,
use the Netlify CLI (`netlify dev`).
