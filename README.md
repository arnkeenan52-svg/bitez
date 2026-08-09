# bitez — launch site

Phase-1 pre-launch website for **bitez**, vegan protein gummies. _Candy that counts._

Static single page: brand story + email waitlist. No checkout (product is in
supplier sampling). Flavor sections are structured as standalone articles so
they can become product pages when the store (Shopify or similar) lands.

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

1. **Waitlist endpoint** — set `FORM_ENDPOINT` at the top of `js/main.js` to a
   Formspree/Mailchimp POST URL. While it's empty the form demos the success
   state without sending anything.
2. **Assets** — drop the real product shots into `assets/` (see
   `assets/README.md`). Placeholders disappear automatically.
3. **Absolute URLs** — replace the relative `og:image` / `twitter:image` in
   `index.html` with the absolute production URL, and add `og:url` +
   `<link rel="canonical">` once the domain is live.
4. **Legal** — replace `[legal company details placeholder]` in the footer.

## Brand guardrails (baked into the copy — keep it that way)

- Honest numbers only: 10g protein / ~100 kcal / ~4g sugar per 48g bag; 20g protein / ~200 kcal per 96g bag. Never inflate.
- It's a protein **snack** / candy replacement — never a meal replacement.
- No health/medical/weight-loss claims, no "clinically proven" (EU food-claim rules).
- Never mention whey. Product is vegan: hydrolyzed pea protein + pectin.
- Red (`#E63950`) is for urgency only (announcement bar, tags) — ≤10% of any view.
- No pure black — forest green `#225E30` is the "black".
