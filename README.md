# bitez — launch site

Pre-launch website for **bitez**, vegan protein gummies. _Candy that counts._

Static multi-page site: brand home (`index.html`) plus product pages per
flavor (`green-apple.html`, `strawberry.html`, `pineapple.html`). First-drop
list model (phase 1, no payments): visitors pick a pack (one-time 3/6/9 or
subscribe-and-save monthly), and the choice is stored with their email via
the join form. The shop emails a payment link when the first drop ships,
8–12 weeks out. Swap the join form for real checkout when ready.

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
- Vanilla JS (`js/main.js`) — pack chooser + first-drop join form, gummy confetti, sticky mobile CTA, asset fallbacks
- Self-hosted Baloo 2 + Nunito (`fonts/`) — no third-party requests, no cookies, no trackers (keeps the site consent-banner-free in the EU)

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

## Before launch checklist

1. **List endpoint** — set `FORM_ENDPOINT` at the top of `js/main.js`
   to a Formspree/Mailchimp POST URL. It receives email, selection
   (e.g. "onetime-6" / "sub-9") and selection_label per signup. While
   it's empty the form demos the success state without sending anything.
   Flavor votes are front-end only.
2. **Assets** — real pack shots for all three flavors are in `assets/`
   (see `assets/README.md`).
3. ~~Absolute URLs~~ — done: eatbitez.com canonicals, og:url, absolute
   social images, robots.txt, sitemap.xml and Product schema are in.
4. **Legal** — replace `[legal company details placeholder]` in the footer.
5. **Trust content that needs the owner** (conversion audit findings):
   the real ingredient list + sweetener + allergens in the "what's inside"
   accordion (it currently promises the list "before launch"), a support
   email in the footer, a short "who's making this" founder note, and a
   lab-reports page (or lab name) to back the "we publish the reports"
   claim.

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
