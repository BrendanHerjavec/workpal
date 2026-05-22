# WorkPal

A corporate tamagotchi that lives in the corner of your screen and judges your work hygiene. Unread emails make it sad. Overdue tasks make it sick. Clearing your inbox makes it grow into a tiny executive with a tiny briefcase.

Tamagotchi meets RescueTime, but cute and shameful in equal measure.

## Run it

```bash
npm install
npm start
```

Tested with Electron 31, Node 18+. The window is frameless, transparent, always-on-top, and 240×280px. Drag from the empty space around the pet. Hover for stats. Right-click for the menu (pause, debug panel, revive, reset, quit, always-on-top toggle).

## How it works

- `main.js` — Electron shell, frameless transparent window, IPC bridge for the store and native menu.
- `preload.js` — exposes a tiny `window.workpal` API to the renderer.
- `src/index.html` — loads React + Tailwind via CDN, no build step.
- `src/renderer.js` — React app: sprite, stats panel, debug panel, speech bubbles, confetti.
- `src/sprite.js` — Pixel-art SVG sprites drawn inline. Six stages × five moods. No external assets.
- `src/mood.js` — Wellness score, mood mapping, daily evolution tick, passive-aggressive copy.
- `src/productivitySource.js` — **swap this to plug in real data**.

### Wellness score (0–100)

Base 70, modified by:
- Unread emails: −5 (>5), −15 (>20), −35 (>50), −60 (>100)
- Overdue tasks: −4 (>0), −12 (>3), −25 (>5), −50 (>10)
- Completed tasks today: +3 each, capped at +20
- Focus minutes today: +1 per 15min, capped at +20

Mood thresholds: `dying ≤15`, `sad ≤40`, `neutral ≤60`, `happy ≤85`, `thriving >85`.

### Evolution

`Egg → Blob → Sprout → Junior → Senior → Executive`. Every 3 cumulative good days (score ≥65) advances a stage. Two bad days (score ≤30) in a row regresses a stage. Three consecutive near-zero days and the pet "dies" — it sits there grey and sweating until you revive it via the menu or have a clean day. It never actually dies forever.

## Integrations — plug in real data

Edit `src/productivitySource.js`. The `getStats()` function returns the shape:

```js
{ unreadEmails, overdueTasks, todaysCompletedTasks, focusMinutes }
```

Flip `settings.mockMode` to `false` in the store (or via a future toggle) and fill in the real fetchers:

- **Gmail API** — wired up out of the box. Right-click the pet → **Connect Gmail…**. One-time setup:
  1. Go to https://console.cloud.google.com → New Project.
  2. APIs & Services → **Enable APIs** → enable **Gmail API**.
  3. APIs & Services → **OAuth consent screen** → External → fill in app name + your email; **add your own email as a Test user**.
  4. APIs & Services → **Credentials** → Create Credentials → **OAuth Client ID** → Application type: **Desktop app**. Copy the Client ID and Client Secret.
  5. In WorkPal: right-click pet → Connect Gmail… → paste both → Continue. Your browser will open, you'll authorize, done.
  - Tokens are encrypted with the OS keychain (`safeStorage`) and stored in `electron-store`. Disconnect at any time from the same menu.
  - Scope used: `gmail.readonly` (only one call: `GET /labels/INBOX` → `messagesUnread`). No emails are read, only the unread counter.
- **Google Calendar** — `events.list` for today's primary calendar; subtract meeting minutes from `focusMinutes` if you want focus = (work hours − meetings).
- **Linear** — `linear-sdk`. Query `issues(filter: { assignee: { isMe: { eq: true } }, state: { type: { neq: "completed" } }, dueDate: { lt: "TODAY" } })`. Length = `overdueTasks`. Count today's completed for the bonus.
- **ClickUp** — `GET /api/v2/team/{team_id}/task?assignees[]=me&due_date_lt=<now-ms>&include_closed=false`.
- **Focus minutes** — RescueTime, ActivityWatch, or your own keystroke-active-window heartbeat. Sum minutes spent in IDE / editor / docs categories today.

Each integration should be defensive: if a call fails, fall back to the last cached value rather than spiking the pet's mood.

## Debug panel

Right-click the pet → **Debug panel…**. Sliders for all four mock inputs, live-updates the pet. Use this to verify every mood and the regression / death loops without faking real data.

## Persistence

`electron-store` writes to the standard OS app data dir (`~/Library/Application Support/workpal` on macOS). Saved: cumulative good days, current stage, last tick date, 30-day score history, death-day counter, settings. The 7-day streak bars in the stats panel pull from this.

## Roadmap-ish

- Native notification when mood crosses into `dying`.
- Login-item registration so it auto-starts.
- Per-source weighting (people who live in Slack will want to add it to the score).
