# Raise — project handoff

Everything decided and built for **Raise** (`tryraise.app`), a Duolingo-style
iOS app that walks a beginner through making a sourdough starter in 10 days,
then baking their first loaf.

Written so a fresh session can pick up without the original conversation.
Owner: Quartz Mølle ApS (Danish flour mill).

---

## 1. The product

**One sentence:** ten days, one feed a day, a rabbit who reacts to whether you
did it, and at the end you bake a loaf.

**The core loop, which is the whole product:**

1. Daily local notification at a user-chosen time — "Rocky is hungry"
2. Open app → rabbit's expression reflects how overdue the feed is
3. Tap Feed → rabbit turns happy, streak ticks
4. Repeat for 10 days → bake

Everything else (path screen, chapters, Ask tab, friends, badges) is
scaffolding around that loop. If the loop doesn't hold someone for ten days,
nothing else matters.

**Why this is the wedge:** no sourdough app has simplified it down to daily
notifications plus a character. The category is all reference material and
timers.

---

## 2. Market and business decisions

### Category size (researched from real store data)

| Signal | Number |
|---|---|
| r/Sourdough subscribers | ~748,000 |
| All sourdough apps on US App Store, total ratings | ~2,000 |
| Category leader (Loaflo), ratings in 2 years | 508 |
| BakeWay (AI angle), ratings in 5 months | 347 |

Read: the audience is large and the existing apps are tiny. The AI angle is
the fastest-growing signal in the category. Low competition, real demand.

### Pricing — decided

- **59 kr/month**
- **399 kr/year**
- **3-day free trial on the annual plan only**
- **Trial starts at install**, not at day 10

The reasoning for trial-at-install: they start their starter, get the
notifications, get emotionally invested, and the charge lands while they're
still in it. Waiting until day 10 to monetise means paid acquisition can never
pay back inside a normal attribution window.

### Legal / IP position

- **Copyright: fine.** All assets and code are original.
- **Trade dress: the zigzag path is the exposure.** It's the most
  recognisably Duolingo element.
- **Nearer practical risk is App Store guideline 4.1 (Copycats)**, not a
  lawsuit.

### Known EU issue on the other app

Songspot: Guess the song (id 6808657554) is live in 36 non-EU storefronts and
absent from all 27 EU ones. Norway, Iceland, Switzerland and the UK are live —
the cut falls exactly on EU membership, which confirms **DSA trader-status
verification** as the cause, not a review rejection. Same verification will
gate Raise in the EU, so file it early.

---

## 3. Brand

### The mascot

One rabbit. Not a roster of buddies — that was abandoned after looking at
BitePal, which carries a single raccoon through its whole onboarding.

**Master render:** `ios/Raise/Artwork/reference/master-rabbit.png`

Locked character spec — every new asset must match:

- Soft grey fur, cream belly and muzzle, pale pink inner ears
- **One ear standing straight up, one ear flopped over to the side** — this is
  the signature. It's what makes the silhouette identifiable, and it's the best
  idea in the whole exploration
- Two large glossy black eyes, white rims, single white highlight each
- Tiny pink nose, soft pink blush on both cheeks, small cotton tail
- Thick uniform black keyline, flat colour, no gradients
- Head roughly 50% of total figure height

An earlier lavender-fur variant is kept at
`reference/master-rabbit-lavender.png` but grey is the decision.

**Name:** not finalised. "Rocky" is the default in code.

### Colour — the one unresolved brand decision

The rabbit being grey-white is an asset, not a weakness: it sits on any
background, so the brand colour stays a free choice. Duolingo is locked to
green forever; you aren't.

**The icon currently owns no colour**, which is the problem. Grey-blue
background behind a grey-white rabbit is monochrome and disappears in a search
results list.

Taken in the baking category: cream, beige, brown, wheat-gold. Nearly every
competitor is some shade of toast.

**Recommendation: terracotta / burnt orange.** Warm enough to read as food,
unowned in the category, highest contrast against a grey-white rabbit. Deep
plum is the alternative.

`DesignSystem.swift` already ships terracotta `#C85A3C` as the accent. Change
it there and it propagates.

### App icon

Candidates preserved in `ios/Raise/Artwork/icon-candidates/`.

Tested at 160 / 96 / 56 / 38 / 22px against real iOS corner masking.

- **`icon-teeth-open-mouth.png` is the strongest.** The open pink mouth is a
  third high-contrast mark, so it holds its shape at 38px where the others
  collapse into "grey blob with two dots"
- Two fixes it still needs: **mirror the eyes** (the right one is currently
  smaller and tilted, which reads as a wobble rather than a choice), and
  **enlarge the teeth** so they survive at 40px
- `icon-charcoal.png` and `icon-terracotta.png` are the best of the
  full-head crops

**Settled: the icon does not need ears.** Duolingo's icon is a face with no
body; the App Store screenshots and the app name carry the species.

**Icons must bleed off the tile edges.** Both Duolingo and BitePal crop the
face so it overflows the frame. Any icon with margin around the head reads as
weak.

---

## 4. Artwork inventory

All in `ios/Raise/Artwork/`, 1024px, transparent PNG.

### Twelve expressions, each mapped to an app state

| File | Fires when |
|---|---|
| `rabbit_idle` | Default, nothing due |
| `rabbit_hungry` | 2h before the feed window |
| `rabbit_starving` | Feed overdue |
| `rabbit_fed` | 0–30 min after logging a feed |
| `rabbit_proud` | Chapter complete |
| `rabbit_sleepy` | Night hours, nothing due |
| `rabbit_excited` | Starter doubles, new chapter |
| `rabbit_thinking` | Ask tab |
| `rabbit_sad` | Streak broken |
| `rabbit_love` | 7+ day streak |
| `rabbit_surprised` | First bubbles |
| `rabbit_cheering` | Onboarding, encouragement |

**Known flaw:** `idle`, `proud`, `sad` and `surprised` came back with both ears
up, losing the asymmetric signature. Worth a re-run. `sleepy` and `love` have
both ears down, which breaks the rule but reads as intentional emotion — keep
those.

### How to generate more, consistently

Generated with Higgsfield, model `gpt_image_2_5`.

Non-obvious parameters that matter:

- `quality` **defaults to `low`** — always pass `high` explicitly
- `resolution: 2k`, `background: transparent`
- Pass the master render as `medias[{ role: "image_references" }]`
- Batches over 8 hit 429 rate limits; resubmit failed indices separately

Prompt template that produced the consistent set:

> Keep the EXACT same rabbit character as the reference image, identical in
> every way: soft grey fur, cream belly and muzzle, pale pink inner ears, one
> ear standing straight up and one ear flopped over to the side, two huge
> glossy black eyes with white rims and a white highlight, tiny pink nose,
> small cotton tail, thick uniform black keyline, flat colour. Standing
> upright, front facing, centred. EXPRESSION: `<describe it>`. Flat vector
> sticker illustration, transparent background, no text, no ground shadow.

---

## 5. Onboarding — review findings

A ~14-screen flow was designed in Figma-style mockups. Overall verdict: **top
decile for an indie app.** The condensed headline treatment, the mascot in
nearly every frame, the tilted card stack and the personality picker are better
than most funded apps in the category ship.

### Two ship-blockers — not design opinions

**1. The fake ratings screen must be cut.**
It showed "4.9 average rating", "1M+ bakers", and two five-star reviews from
invented users, for an app that hasn't launched.

- **EU/Danish law:** the Omnibus Directive, implemented in Markedsføringsloven,
  bans presenting fabricated consumer reviews. Penalties scale to turnover.
  Denmark is the home jurisdiction here.
- **Apple:** custom rating prompts are explicitly disallowed. You must use
  `SKStoreReviewController`.

Bring it back post-launch with real numbers, through the native API, after
someone completes day 3.

**2. "Easier to digest" is a health claim.**
On the fermentation screen, paired with an uncited "Studies show". App Store
review rejects these from apps without medical backing. Reword to flavour and
texture only: *"Slow fermentation. Deeper flavour."*

### Structural notes

- **Two zero-information interstitials** ("Now let's talk about your baking
  habits", "Got it! We'll help you reach your baking goals"). Each is a
  drop-off point with no payoff. Merge into one screen that quotes their
  answers back: *"Completely new, and you want a first loaf. That's 10 days —
  feed Rocky once a day and I'll tell you exactly when."*
- **The goal is asked twice** — an early "What is your main goal?" and a later
  "Set your baking goal" button.
- **The reminders screen has no time picker.** That screen sets up the entire
  notification loop, which is the core of the product. It needs an actual
  clock, prefilled to something sensible. *(Fixed in the shipped code.)*
- **A question screen is redundant** — if they answered "I'm completely new",
  don't then ask whether they know how to feed a starter. Branch it.
- **Decoration badges read as selection state.** Blue check marks and green
  refresh icons on option-row artwork make unselected rows look selected. This
  appeared on three separate screens.
- **Several screens are two-thirds empty**, content floating in the middle 25%.
- **No progress indicator** across fourteen screens. *(Fixed in the shipped
  code.)*

### Colour incoherence

Across the flow the backgrounds run pale blue, grey, cream-yellow, pink, and a
pastel rainbow. The app has no colour identity — the same problem as the icon.
Pick one ground and one accent. *(The shipped code enforces this via
`Theme.ground` + `Theme.accent`.)*

### What was working

Tilted card stack, personality picker (the sunglasses "Straight talker" rabbit
is the most charming asset produced), naming screen with a prefilled name,
black pill buttons, the condensed headline face, and the Skip-as-text-link
hierarchy once it was corrected.

---

## 6. Product decisions on customisation

Asked whether to ship changeable backgrounds, hats, glasses, expressions.

- **Expressions: yes, and they aren't a feature — they're the product.** The
  rabbit reacting to starter state is the emotional loop. Already built.
- **Hats: yes, but only ~5, and only as day-milestone unlocks.** Day 3, 7, 10,
  first loaf, 30-day streak. This attacks the real retention problem, which is
  days 4–7 when the starter looks dead and boring.
- **Changeable backgrounds: no for v1.** Pure vanity, no behavioural pull, and
  it fights the brand colour you're still trying to establish.

**The cost trap:** every accessory has to be drawn on every pose or it looks
broken. 5 hats × 8 poses = 40 renders that all have to sit correctly on a head
that moves. **The way around it:** draw accessories as separate transparent
PNGs anchored to one fixed head position, and only show them on the single hero
pose on the Today screen. Nobody notices. 40 renders becomes 5.

---

## 7. The code

Shipped on branch `claude/app-research-revenue-iowr7u` under `ios/`.

A **vertical slice**, not the full flow: onboarding → Today → feed → local
notification. Three onboarding screens, because those are the only ones that
change what the app does. The other eleven are questions whose answers nothing
reads yet.

```
ios/
  README.md                        ← Xcode setup, step by step
  HANDOFF.md                       ← this file
  Raise/
    RaiseApp.swift
    DesignSystem.swift             ← one ground, one accent, the black pill
    Models/
      Mood.swift                   ← the mood engine
      StarterStore.swift
    Services/
      NotificationManager.swift    ← local only, no paid account needed
    Views/
      OnboardingFlow.swift
      TodayView.swift
      RabbitView.swift
    Artwork/
      rabbit_*.png                 ← the 12 expressions
      reference/                   ← master render, expression sheet
      icon-candidates/             ← tested icon options
```

### The mood engine — `Models/Mood.swift`

| Time since last feed | Mood |
|---|---|
| under 30 min | `fed` |
| under 85% of interval | `idle`, or `sleepy` between 22:00 and 06:00 |
| 85%–150% | `hungry` |
| over 150% | `starving` |

Interval is 24h, in `StarterStore.feedInterval`. Set it to `60` to watch the
states cycle in a minute instead of a day.

### Two gotchas already handled

- **`@AppStorage` does not work inside an `ObservableObject`.** It's a
  `DynamicProperty` built for views; in a class it stores correctly but never
  fires `objectWillChange`, so the UI silently stops updating. `StarterStore`
  backs `@Published` with `UserDefaults` in `didSet` instead.
- **`RabbitView` falls back to a labelled placeholder** when an image set is
  missing, so the app runs before artwork is imported rather than rendering
  purple.

### Getting it on a phone

**No $99 developer account needed.** A free Apple ID deploys to your own
device; the build expires after 7 days and you re-run to refresh. Local
notifications — the entire core loop — work on a free account. The $99 is only
for TestFlight, the App Store, and push-from-server.

Full steps in `ios/README.md`.

**Test affordances built in:**
- "Send a test notification" on the Today screen, fires in 10 seconds. Lock the
  phone first — iOS suppresses notifications in the foreground.
- Long-press the rabbit's name for 1.5s to wipe state and replay onboarding.

### Not built yet

The remaining onboarding questions, the path/chapter screen, the Ask tab,
accounts, the paywall, and streaks beyond a feed counter.

---

## 8. Next actions, in order

1. **Build it on the phone** and see whether the loop feels right. Nothing else
   is worth doing until that's answered.
2. **Fix the two ship-blockers** in the design files — delete the fake-reviews
   screen, reword the digestion claim.
3. **Pick the brand colour.** Terracotta is the recommendation; it's already
   wired as `Theme.accent`.
4. **Finalise the icon** — mirror the eyes and enlarge the teeth on
   `icon-teeth-open-mouth.png`.
5. **Re-run the four expressions** that lost the flopped ear.
6. **File EU DSA trader verification early** — it gated the other app for weeks.
7. Build out the remaining onboarding screens, merging the two interstitials
   into one personalised summary.

---

## 9. Housekeeping

- A Figma personal access token was pasted into the originating conversation
  and should be treated as compromised. **Rotate it** at figma.com → Settings →
  Security → Personal access tokens.
- The `21st` and `figma` MCP servers need interactive authorisation and were
  unavailable.
