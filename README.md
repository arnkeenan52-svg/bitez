# bitez — launch site

Pre-launch website for **bitez**, vegan protein gummies. _Candy that counts._

Static multi-page site: brand home (`index.html`) plus product pages per
flavor (`green-apple.html`, `strawberry.html`, `pineapple.html`), a
Shopify-style checkout (`checkout.html` + `thanks.html`) and Stripe-backed
serverless functions in `/api`. Visitors pick a pack (one-time 3/6/9 or
subscribe-and-save monthly), add it to the bag, and pay real money at
checkout:

- **One-time packs** are charged today (PaymentIntent, EUR).
- **Subscriptions** are €0 today: the card is saved via a trialing Stripe
  subscription and the first charge happens when the first drop ships
  (`SUB_TRIAL_DAYS`, default 70 days — see "Operating payments").
- **Mixed bags** charge the one-time part today, save the card, and the
  thanks page finalizes the subscription with the saved card.

**Offer** in `green-apple.html` ("choose your bitez"): one-time 3-pack
€26.99 · 6-pack €49.99 (most popular, free shipping) · 9-pack €69.99;
subscribe & save 15%: 3/month €22.99 · 6/month €42.49 · 9/month €58.99.
Free shipping on 6-packs and up. No single-bag price on the site (singles
sell elsewhere). ⚠️ Confirm prices and the free-shipping threshold before
launch.
The 14-day money-back guarantee shown on the product page was added at
the owner's request. The 96g bag is the only size — there are no
small/share sizes.

## Stack

- Plain HTML (`index.html`) + [Tailwind CSS v4](https://tailwindcss.com) compiled to a single static stylesheet (`css/styles.css`)
- Vanilla JS (`js/main.js`) — pack chooser, cart drawer, gummy confetti, sticky mobile CTA, asset fallbacks; `js/checkout.js` + `js/thanks.js` run the checkout
- Vercel serverless functions (`api/*.js`, Node) + the `stripe` SDK for payments
- Self-hosted Baloo 2 + Nunito (`fonts/`) — the store pages make no third-party requests and set no cookies. The exception is `checkout.html`/`thanks.html`, which load Stripe.js from js.stripe.com for payment processing (strictly necessary for the service, but mention Stripe in the privacy policy)

## Develop

```bash
npm install        # once
npm run build      # compile src/tailwind.css → css/styles.css
npm run watch      # rebuild on change
```

Then open `index.html` (or serve the folder: `npx serve .`). The compiled
`css/styles.css` is committed, so the site works without a build step.

When you change CSS or JS, bump the `?v=` query string on the
`styles.css` / `main.js` links in all four HTML files so every visitor
gets the new files immediately.

## Deploy

`vercel.json` is included: Vercel runs the Tailwind build and serves the
repository root (the site has no framework and no output folder). Any static
host works the same way — build, then serve the repo root.

## Operating payments (Stripe)

**Environment variables (Vercel → Project → Settings → Environment
Variables):**

- `STRIPE_SECRET_KEY` — already set by the owner (sk_live_…).
- `STRIPE_PUBLISHABLE_KEY` — ⚠️ **must be added** (pk_live_… from
  https://dashboard.stripe.com/apikeys), then redeploy. Until it's set,
  checkout shows a friendly "payments aren't switched on yet" notice and
  takes no orders.

**Where the money logic lives:** `api/_shared.js` is the single source of
truth — SKU price table (must match the chooser in `green-apple.html`),
flat shipping (`SHIPPING_FLAT_CENTS`, €4.90), free-shipping threshold
(6 bags), subscription trial length (`SUB_TRIAL_DAYS`, 70 days ≈ the
8–12-week ship window) and the EU-27 ship-to list. The client only ever
sends SKUs + quantities; every amount is recomputed server-side.

**Endpoints:** `GET /api/config` (publishable key + catalog),
`POST /api/create-intent` (prices the bag, mints the PaymentIntent /
trialing subscription), `POST /api/validate-code` (discount pre-check),
`POST /api/complete` (idempotently starts the subscription part of a mixed
order from the thanks page), `POST /api/webhook` (Stripe webhook — the
reliable path for the same finalization; see below).

**Owner to-dos in the Stripe Dashboard:**

1. Register payment-method domains (Settings → Payment method domains):
   `eatbitez.com`, `www.eatbitez.com` — otherwise the Apple Pay button
   silently never appears.
2. Enable the trial-ending reminder email (Billing → emails) so
   subscribers get notified ~3 days before their first charge — card
   networks expect this for €0-today trials.
3. Enable failed-payment / receipt emails as desired.
4. **Webhook (strongly recommended):** Developers → Webhooks → add
   endpoint `https://eatbitez.com/api/webhook` listening to
   `payment_intent.succeeded`, then add the signing secret as
   `STRIPE_WEBHOOK_SECRET` in Vercel env. This guarantees mixed-cart
   subscriptions start even when the buyer never returns to the thanks
   page. Until it's set, check the Dashboard weekly for PaymentIntents
   with `pending_subs` metadata that have no matching subscription
   (metadata `source_payment_intent`), and re-run them by opening the
   order's thanks link or creating the subscription manually.
5. Discount codes: create Coupons + Promotion Codes in the Dashboard —
   the site picks them up automatically (applies to one-time packs only
   in v1). Codes with `max_redemptions` or first-time-customer
   restrictions are rejected at checkout, because one-time-leg discounts
   are applied as adjusted amounts and never register a Stripe redemption
   — the caps couldn't be enforced. Use expiry dates instead.
6. Subscriptions accept **cards only** in v1 (the checkout and the
   subscription's SetupIntent are pinned to matching payment-method
   lists). Mixed carts paid via iDEAL/Bancontact are handled: the
   generated SEPA debit is used for the subscription.
7. If the drop slips past ~10 weeks: bulk-extend `trial_end` on trialing
   subscriptions (Dashboard or API) so nobody is charged before shipping.
   The site copy promises "we email you before the first charge".
8. Do **not** edit subscription prices in the Dashboard — the API guards
   against price drift and will refuse checkout if Stripe's price differs
   from the site's. Change `CATALOG` in `api/_shared.js` instead.
9. ⚠️ **VAT**: the site currently makes no VAT statement at checkout.
   B2C prices in the EU must be VAT-inclusive — confirm your VAT
   registration/handling (and consider Stripe Tax), then a "prices
   include vat" line can be added to the summary.
10. Sanity-check once in live mode: place one €22.99 subscription order
    yourself end-to-end (card save, €0 charge, trialing subscription
    appears) before announcing the drop.

**Known v1 limits:** subscription orders always ship free (shipping is
folded into the monthly price) — one-time packs under 6 bags pay €4.90.
Ship-to countries are the EU-27 (enforced server-side). Sub-only orders
store their delivery address in the subscription's `ship_to` metadata.
Without the webhook configured, mixed-cart finalization depends on the
buyer reaching the thanks page (see Dashboard to-do 4).

## Before launch checklist

1. ~~Payments~~ — Stripe checkout is wired (see "Operating payments").
   Remaining: add `STRIPE_PUBLISHABLE_KEY` env var + the Dashboard to-dos
   above. Flavor votes are still front-end only.
2. **Assets** — real pack shots for all three flavors are in `assets/`
   (see `assets/README.md`).
3. ~~Absolute URLs~~ — done: eatbitez.com canonicals, og:url, absolute
   social images, robots.txt, sitemap.xml and Product schema are in.
   `checkout.html`/`thanks.html` are noindex and out of the sitemap.
4. **Legal** — replace `[legal company details placeholder]` in the footer.
   ⚠️ Now that real money is charged, EU consumer law requires proper
   trader identity, terms, privacy + withdrawal-right pages before scale —
   the checkout's policy links currently point at the FAQ. Also confirm
   VAT handling (site shows "prices include vat"; Stripe Tax is off).
5. **Trust content that needs the owner** (conversion audit findings):
   the real ingredient list + sweetener + allergens in the "what's inside"
   accordion (it currently promises the list "before launch"), a support
   email in the footer, a short "who's making this" founder note, and a
   lab-reports page (or lab name) to back the "we publish the reports"
   claim.
6. **Reviews (after the first drop delivers)** — the `#reviews` section on
   `index.html` and `green-apple.html` ships with an honest "no reviews
   yet" card. Each page has a commented-out `REAL-REVIEW TEMPLATE` card
   right below it: copy it once per review, fill it with the customer's
   actual words, then delete the empty-state card. Verified purchases
   only — publishing invented reviews is illegal in the EU (Directive
   2019/2161) and against the brand guardrails.

## Design system

Component styling follows **claymorphism** (soft 3D, toy-like — fits the
gummy product): 16–24px radii, thick light borders, double shadows (outer
drop + inner highlight, tokens `--shadow-clay` / `--shadow-clay-btn` in
`src/tailwind.css`), soft squish on press, scroll-triggered reveals
(IntersectionObserver, disabled for `prefers-reduced-motion` and no-JS).
Images ship as WebP with JPEG fallback and responsive `srcset`.

## Brand guardrails (baked into the copy — keep it that way)

- Honest numbers only: 20g protein / ~200 kcal / ~8g sugar per 96g bag (the only size). Never inflate.
- It's a protein **snack** / candy replacement — never a meal replacement.
- No health/medical/weight-loss claims, no "clinically proven" (EU food-claim rules).
- The recipe **does contain artificial flavours/colours** — never claim "no artificials" anywhere on the site. That information lives on the printed label only.
- Never mention whey. Product is vegan: hydrolyzed pea protein + pectin.
- Red (`#E63950`) is for urgency only (announcement bar, tags) — ≤10% of any view.
- No pure black — forest green `#225E30` is the "black".
