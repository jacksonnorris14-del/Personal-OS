# Personal OS

A personal command center for one person, installable on an iPhone home screen.
No accounts, no server, no subscriptions. Everything lives on the device.

```
LONG-TERM GOALS  →  CURRENT PROJECT  →  THIS WEEK'S BIG WIN  →  TODAY'S MUST WIN  →  NEXT ACTION
```

## What it does

| Screen | Purpose |
| --- | --- |
| **Today** | One Must Win, up to two Secondary Wins, the standards that apply to *this* day, sleep targets, weekly workout and social counts, the Money Engine, and Salvage mode. |
| **Plan** | Tomorrow in three decisions (the third optional), plus Today / Upcoming / Inbox / Done task lists. |
| **Money** | One current project, always with a visible next action, and a Build-vs-Learn balance over the last 14 days. |
| **Goals** | Long-term outcomes with category, priority, target date, and status. Direction, not a to-do list. |
| **More** | History and trends, Sunday Reset, Settings, and backup/restore. |
| **Capture** (＋) | Anywhere, any time. One field, defaults to the Inbox so nothing demands a decision mid-thought. |
| **Focus** | "What are you supposed to be doing right now?" — one honest answer, an optional timer. |

### The rules built into it

- **One Must Win a day.** Two secondary, at most. The cap is the feature.
- **Minimum beats ideal.** 3 workouts is a successful week; 4 is a bonus, never the bar.
- **Never miss twice.** A miss produces one calm nudge on the next occasion, not a broken streak.
- **Salvage, don't scrap.** A bad day shrinks to three moves instead of ending the system.
- **Build before learn.** Research is allowed; output is what the app keeps score of.
- **Earned leisure, without guilt.** When the mission is handled, the app says so plainly.
- **No points, levels, streaks, or shame scores.** Just what happened, so patterns are visible.

Standards adapt to the day: the faith row shows the commitment actually scheduled
(personal study, church, or group study), school is quiet on weekends, movement is only
"required" when it's the last chance to reach the weekly minimum, and Sunday's Money
Engine work is the review inside Sunday Reset.

The day rolls over at **3:00 AM**, so a late-night check-in still belongs to the day
you're finishing.

## Install it on an iPhone

1. Publish the files (see below) and open the URL in **Safari** on the phone.
2. Tap **Share** → **Add to Home Screen**.
3. Open it from the home screen. It runs full-screen, works offline, and keeps its data
   on the device.

### Publishing with GitHub Pages

The app is plain static files with no build step, so the repository can be served as-is.

- **Simplest:** repo **Settings → Pages → Source: Deploy from a branch**, pick the branch
  and `/ (root)`. The app appears at `https://<user>.github.io/<repo>/`.
- **Or via Actions:** set **Source: GitHub Actions**; `.github/workflows/pages.yml`
  publishes on every push to `main`.

Any static host works — the app only needs the files served over HTTPS.

## Running it locally

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

A service worker only registers over HTTPS or on `localhost`.

## Your data

Everything is one JSON object in `localStorage` under the key `personal-os`. It never
leaves the device.

- **More → Export a backup** copies the whole thing to the clipboard.
- **More → Restore from a backup** pastes it back, on this device or another.

Clearing Safari's website data for the site erases it, so export occasionally. Because all
state flows through one store module (`js/store.js`), adding cloud sync later means
changing one read/write seam rather than the whole app.

## How it's built

Vanilla ES modules, no framework, no bundler, no dependencies — it loads in one round trip
and stays easy to change.

```
index.html              shell: nav, capture button, sheet + focus layers
manifest.webmanifest    installable PWA metadata
sw.js                   offline cache (network-first for the page, cache-first for assets)
css/app.css             the whole design system
js/
  app.js                router, bottom nav, service-worker registration
  store.js              state, persistence, migrations, CRUD
  logic.js              domain rules: standards, sleep, workouts, nudges, stats
  util.js               dates (3 AM rollover, Sunday-led weeks), formatting
  ui.js                 bottom sheets, toasts, confirmations, small builders
  capture.js            the capture sheet
  focus.js              the focus overlay
  pick.js               choose-or-create task picker
  tasks-ui.js           shared task row and editor
  views/                today, plan, money, goals, more, stats, settings, sunday
scripts/make_icons.py   regenerates the icon set (pure stdlib, no image libraries)
```

Views expose `render()` and `mount(root)`; every mutation goes through `mutate()` in the
store, which saves and re-renders. That is the entire architecture.
