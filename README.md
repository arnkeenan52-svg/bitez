# bitez — launch site

Pre-launch website for **bitez**, vegan protein gummies. _Candy that counts._

Static multi-page site: brand home (`index.html`) plus product pages per
flavor (`green-apple.html`, `strawberry.html`, `pineapple.html`). Pre-order
model: visitors reserve bags (size × qty + email, nothing charged); the shop
emails a payment link when the order ships, 8–12 weeks out. No payment
processing on the site — swap the reservation form for Shopify/Stripe
checkout when ready.

⚠️ **Placeholder offer** in `green-apple.html`: the buy box sells the 96g
bag in packs — 1 bag €4.90 · 3-pack €12.90 (save 12%, free EU shipping) ·
6-pack €22.90 (save 22%). Prices, discounts and the free-shipping promise
are placeholders — confirm before launch. The 14-day money-back
guarantee shown on the product page was added at the owner's request. Small/share bag sizes (48g/144g,
144g itself an assumption) appear in nutrition info only.

## Stack

- Plain HTML (`index.html`) + [Tailwind CSS v4](https://tailwindcss.com) compiled to a single static stylesheet (`css/styles.css`)
- Vanilla JS (`js/main.js`) — waitlist forms, gummy confetti, sticky mobile CTA, asset fallbacks
- Self-hosted Baloo 2 + Nunito (`fonts/`) — no third-party requests, no cookies, no trackers (keeps the site consent-banner-free in the EU)

## Develop

```bash
npm install        # once
npm run build      # compile src/tailwind.css → css/styles.css
npm run watch      # rebuild on change
```

Then open `index.html` (or serve the folder: `npx serve .`). The compiled
`css/styles.css` is committed, so the site works without a build step.

## Deploy

`vercel.json` is included: Vercel runs the Tailwind build and serves the
repository root (the site has no framework and no output folder). Any static
host works the same way — build, then serve the repo root.

## Before launch checklist

1. **Pre-order endpoint** — set `FORM_ENDPOINT` at the top of `js/main.js`
   to a Formspree/Mailchimp POST URL. It receives size, qty, email and
   total_eur per reservation. While it's empty the form demos the success
   state without sending anything. Flavor votes are front-end only.
2. **Assets** — real pack shots for all three flavors are in `assets/`
   (see `assets/README.md`). Still optional: `nutrition-flatlay.png`.
3. **Absolute URLs** — replace the relative `og:image` / `twitter:image` in
   `index.html` with the absolute production URL, and add `og:url` +
   `<link rel="canonical">` once the domain is live.
4. **Legal** — replace `[legal company details placeholder]` in the footer.

## Design system

Component styling follows **claymorphism** (soft 3D, toy-like — fits the
gummy product): 16–24px radii, thick light borders, double shadows (outer
drop + inner highlight, tokens `--shadow-clay` / `--shadow-clay-btn` in
`src/tailwind.css`), soft squish on press, scroll-triggered reveals
(IntersectionObserver, disabled for `prefers-reduced-motion` and no-JS).
Images ship as WebP with JPEG fallback and responsive `srcset`.

## Brand guardrails (baked into the copy — keep it that way)

- Honest numbers only: 10g protein / ~100 kcal / ~4g sugar per 48g bag; 20g / ~200 kcal per 96g; 30g / ~300 kcal per 144g share bag. Never inflate.
- It's a protein **snack** / candy replacement — never a meal replacement.
- No health/medical/weight-loss claims, no "clinically proven" (EU food-claim rules).
- The recipe **does contain artificial flavours/colours** — never claim "no artificials" anywhere on the site. That information lives on the printed label only.
- Never mention whey. Product is vegan: hydrolyzed pea protein + pectin.
- Red (`#E63950`) is for urgency only (announcement bar, tags) — ≤10% of any view.
- No pure black — forest green `#225E30` is the "black".
