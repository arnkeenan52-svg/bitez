# Raise — iOS demo slice

A running vertical slice: onboarding → Today screen → feed → local notification.
Not the full 14-screen flow. This is the part that proves the product loop works
on a real phone.

## What you need

- A Mac with **Xcode 15 or later** (free, Mac App Store)
- An **iPhone with iOS 17+** and a Lightning/USB-C cable
- A **free Apple ID** — the $99/year Apple Developer Program is *not* required
  to run this on your own phone

The one catch with a free Apple ID: the app expires on your phone after **7 days**.
Rebuild from Xcode to refresh it. Everything in this slice, local notifications
included, works without paying.

## Setup — about 10 minutes

### 1. Create the project

Xcode → **File → New → Project → iOS → App**

| Field | Value |
|---|---|
| Product Name | `Raise` |
| Interface | SwiftUI |
| Language | Swift |
| Storage | None |
| Testing System | None |

Save it anywhere. Xcode generates a `RaiseApp.swift` and `ContentView.swift`.

### 2. Replace the generated files

**Delete** the generated `RaiseApp.swift` and `ContentView.swift` (Move to Trash).

Drag everything from `ios/Raise/` in this repo into the Xcode file navigator,
**except** the `Artwork` folder. In the dialog that appears, tick
**Copy items if needed** and **Create groups**.

You should end up with:

```
Raise/
  RaiseApp.swift
  DesignSystem.swift
  Models/
    Mood.swift
    StarterStore.swift
  Services/
    NotificationManager.swift
  Views/
    OnboardingFlow.swift
    RabbitView.swift
    TodayView.swift
```

### 3. Add the artwork

Open `Assets.xcassets`. For each PNG in `ios/Raise/Artwork/`:

- Drag it into the asset catalog
- Confirm the image set name matches the filename without the extension
  (`rabbit_idle.png` → image set named `rabbit_idle`)

The twelve names the app looks for:

```
rabbit_idle       rabbit_hungry     rabbit_starving   rabbit_fed
rabbit_proud      rabbit_sleepy     rabbit_excited    rabbit_thinking
rabbit_sad        rabbit_love       rabbit_surprised  rabbit_cheering
```

Anything missing renders a labelled placeholder instead of crashing, so you can
add them one at a time.

### 4. Sign it

Select the **Raise** project in the navigator → **Signing & Capabilities** tab.

- Tick **Automatically manage signing**
- **Team**: click the dropdown → Add an Account → sign in with your Apple ID →
  pick the "(Personal Team)" entry
- **Bundle Identifier**: change it to something unique, e.g.
  `dk.quartzmolle.raise`. Anything already taken by another developer is rejected.

### 5. Run it on the phone

- Plug the phone in, unlock it, tap **Trust This Computer**
- Pick your phone from the device dropdown at the top of Xcode (not a simulator)
- Press **⌘R**

First run fails with "Untrusted Developer". On the phone:
**Settings → General → VPN & Device Management → your Apple ID → Trust**.
Press ⌘R again.

## Proving the loop works

1. Run onboarding, name the rabbit, set a reminder time
2. On the Today screen tap **Send a test notification**
3. Lock the phone — the notification fires 10 seconds later

Notifications don't display while the app is in the foreground, so lock the
screen or swipe to the home screen before the 10 seconds is up.

**To replay onboarding**: long-press the rabbit's name on the Today screen for
1.5 seconds. Wipes all state.

## How the mood engine works

`Mood.current(lastFed:interval:)` in `Models/Mood.swift` is the whole thing:

| Time since last feed | Mood |
|---|---|
| under 30 min | `fed` |
| under 85% of interval | `idle` (or `sleepy` between 22:00 and 06:00) |
| 85%–150% | `hungry` |
| over 150% | `starving` |

Feeding interval is 24 hours, set in `StarterStore.feedInterval`.

To test a state without waiting a day, change `feedInterval` to `60` (one minute)
and watch the rabbit cycle through hungry and starving.

## What's deliberately not here

- The remaining onboarding questions — they don't change app behaviour yet
- The path/chapter screen
- The Ask tab
- Accounts, paywall, streaks beyond a feed counter

Those are worth building once the loop above feels right on a real phone.
