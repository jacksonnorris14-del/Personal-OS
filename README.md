# Personal OS

A personal command center for one person, installable on an iPhone home screen.
No accounts, no server, no subscriptions. Everything lives on the device.

The app is a globe of stars. Today's focus sits dead centre; everything else
orbits behind it in order of importance. Drag to turn it, pinch to zoom, tap a
star to open it, tap empty space for the read-out.

## The globe

| Star | What it holds |
| --- | --- |
| **Focus** | The one thing today. Largest, centre, calm red. |
| **Secondary** | Up to two. Good if they happen, never at the focus's expense. |
| **Business** | The current project, a one-tap work log, the last seven days, a learning list. |
| **Christian / Education / Training / Sleep** | The day's commitments. Each lights up when held. |
| **Tomorrow** | The nightly ritual: one focus, up to two secondary, anything unusual. |
| **This week** | The week's one goal, training and social rhythm, the weekly reset. |
| **Life** | Priorities in order, the goal under each, and the daily and weekly cadence that gets you there. |

**Education** holds school for the day, a log of what you've learned outside it
and when, and any reminders tagged to it.

A star grows **spikes** when it wants attention: a reminder due or overdue,
Tomorrow still unplanned late in the evening, or an area you have simply
stopped showing up for. Neglect is measured over ten days and needs at least
four real chances, so a quiet first week never triggers it. Only the two worst
areas spike at once — if everything spikes, nothing does — and anything you've
already handled today never spikes, whatever last week looked like.

Five tabs sit at the bottom, each with a line icon. They aren't pages: tapping
one spins the globe to centre that star, as a shortcut for dragging.
| **Settings** | Sleep times, faith schedule, training targets, school hours, data. |

The corner button holds only what doesn't belong on the globe: Quick Note,
Task List, and Rescue Today.

## The colour of the sky

The background is the region of space you're flying through, and it tracks the
**seven days before today** — blue when you're holding everything, red when
you're not, every shade between. It is deliberately quiet and mostly black.

Today is excluded on purpose. A morning with nothing ticked yet is not a failing
week, and colouring it red would say otherwise. Tap the background for the
numbers behind the colour and the one area worth pushing this week.

## The rules it keeps

- **One focus a day.** Two secondary, at most. The cap is the feature.
- **Minimum beats ideal.** Three sessions is a successful training week; four is a bonus, never the bar.
- **A bad day shrinks, it doesn't end the system.** Salvage reduces the day to three moves.
- **No points, levels, streaks or scores.** The sky brightens as you act; that's the whole reward.
- **Nothing appears twice.** Each fact has exactly one home.
- **No commentary.** The app shows what is true and stays quiet.

## Reminders

Three shapes: a one-off date, every N days (counted from when you last did it),
or every N weeks on chosen days. A reminder can be tagged to a star, which then
grows spikes while it's due. Missing one carries it over rather than resetting
it. Managed under Settings, or added straight from Education.

## The nightly push

The browser can subscribe to a push, but something server-side has to send it.
A scheduled GitHub Action does that — no extra hosting.

**Setup, once:**

1. Install the app to the Home Screen (iOS only allows notifications from an
   installed PWA, 16.4+).
2. **Settings → Nightly Push → Turn On**, then copy the subscription it shows.
3. In the repo, **Settings → Secrets and variables → Actions**, add:
   - `PUSH_SUBSCRIPTION` — what you just copied
   - `VAPID_SUBJECT` — `mailto:` and your email
   - `VAPID_PRIVATE_KEY` — the private half of the key in `push-config.json`
4. Run **Actions → Nightly planning push → Run workflow** to test it.

`scripts/vapid.mjs` generates a fresh key pair if you'd rather make your own —
put the public half in `push-config.json` and the private half in the secret.

The schedule is `15 3 * * *` (UTC) in `.github/workflows/nightly-push.yml`,
which is 10:15 PM US Eastern in winter. GitHub cron has no timezone and is
best-effort, so it can fire a few minutes late and needs shifting when the
clocks change.

## Install it on an iPhone

1. Open the published URL in **Safari**.
2. Share → **Add to Home Screen**.
3. Open it from the icon. Full screen, works offline, data stays on the phone.

Updates land by themselves: open the app and it refreshes to the latest build.

### Publishing

Static files, no build step. **Settings → Pages → Deploy from a branch → main /
(root)**, or let `.github/workflows/pages.yml` publish on push to `main`.

## Running it locally

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

## Your data

One JSON object in `localStorage` under `personal-os`, never leaving the device.
**Settings → Export a backup** copies it out; **Restore** pastes it back.

## How it's built

Vanilla ES modules, no framework, no bundler, no dependencies. The globe is
Canvas 2D with its own projection — no 3D library.

```
index.html              canvas, corner button, build sentinel
css/app.css             the whole design system
sw.js                   offline cache (network-first, cache as fallback)
js/
  app.js                bootstrap, the corner menu, service worker
  sky.js                sphere projection, input, constellation lines, painting
  stars.js              what sits on the globe, ordered by importance
  panels.js             every panel behind every star
  store.js              state, persistence, migrations
  logic.js              the rules: standards, sleep, training, mood, areas
  util.js               dates (3 AM rollover, Sunday-led weeks), formatting
  ui.js                 panels, toasts, confirms, line/dot builders
push-config.json        the VAPID public key (safe to commit)
scripts/make_icons.py   regenerates the icons (pure stdlib)
scripts/vapid.mjs       generates a VAPID key pair
scripts/send-push.mjs   what the nightly workflow runs
```

Index 0 of the star list sits exactly on the pole facing the camera; the rest
spiral to the back. `__POS_BUILD` in `index.html` and `__POS_READY` in
`js/app.js` must be bumped together on every release — a mismatch makes the app
clear its caches and reload rather than run stale modules.
