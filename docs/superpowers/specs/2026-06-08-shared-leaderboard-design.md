# Shared All-Time Leaderboard — Design

**Date:** 2026-06-08
**Status:** Approved (design)

## Problem

The home page (IntroScreen) shows an All Time + This Month leaderboard, but scores
live in per-browser `localStorage` (`useHighScore.js`) with no backend. On the live
site (owner-rpg.vercel.app) a visitor's storage is empty, so the panel is hidden
(`leaderboard.length > 0` guard) and the leaderboard appears "gone." Scores never
sync across players or devices.

Goal: a **real shared leaderboard** — every player's scores persist globally and
everyone sees the same All Time (and This Month) top 5.

## Architecture

Keep the static Vite/React SPA as-is. Add one Vercel Serverless Function backed by
Upstash Redis (via Vercel KV or the Upstash Marketplace integration). The React app
talks to it over `fetch`. No framework change.

We use the `@upstash/redis` client directly (rather than `@vercel/kv`) so the
function works regardless of which integration injects the env vars — it reads
`KV_REST_API_URL`/`KV_REST_API_TOKEN` (Vercel KV) **or**
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (Upstash Marketplace).

```
React SPA  ──fetch──>  /api/scores  ──@upstash/redis──>  Upstash Redis (sorted sets)
   │
   └── falls back to localStorage when the API is unreachable / KV unconfigured
```

## Data model (Redis sorted sets)

- `rpg:alltime` — sorted set. score = points; member = JSON `{id, initials, date}`.
  Unique `id` prevents collisions between identical initials/scores.
- `rpg:month:YYYY-MM` — one sorted set per calendar month, same member shape. The
  "This Month" column reads the current month's set.

Top-5 reads use `ZRANGE key 0 4 REV WITHSCORES`.

## API: `/api/scores` (Vercel Serverless Function)

- `GET` → `{ allTime: Entry[], monthly: Entry[], monthLabel: string }`
  where `Entry = { initials, score, date }`, each list top 5 desc.
- `POST { initials, score }` → validate, `ZADD` to `rpg:alltime` and the current
  `rpg:month:YYYY-MM`, then return the refreshed lists (same shape as GET).

`monthLabel` and the month key are computed from the server clock
(`toLocaleString('default', { month: 'long', year: 'numeric' })` for the label,
`YYYY-MM` for the key).

### Validation (public endpoint)
- `initials`: coerce to string, strip to A–Z, uppercase, max 3 chars; reject if empty.
- `score`: coerce to integer; reject if NaN or < 0; cap at `MAX_SCORE` (a generous
  ceiling above any achievable score) so the endpoint can't be stuffed with garbage.
- On bad input return `400`.

## Frontend changes

- **New** `src/lib/leaderboard.js`:
  - `fetchLeaderboard()` → GET `/api/scores`; on failure resolve from localStorage.
  - `submitScore(initials, score)` → POST; on failure write to localStorage.
  - Both return `{ allTime, monthly, monthLabel }` so callers are source-agnostic.
- `src/App.jsx`: hold `leaderboard`, `monthlyLeaderboard`, `monthLabel` in state;
  fetch on mount and after a successful submit; pass into `IntroScreen` (unchanged
  props) and the Victory screen. `isHighScore(score)` computed against the fetched
  all-time list (`list.length < 5 || score > list[last].score`).
- `useHighScore.js`: retained as the offline/localStorage fallback path only.
- `IntroScreen.jsx`: change the All Time panel to **always render** (placeholder rows
  when empty) so it's visible before anyone has scored. (Today the whole wrap is
  hidden when there are zero all-time scores.)

## Fallback behavior

If `fetch` fails or KV env vars are absent (local `vite dev`, preview deploys
without the store connected), the app silently uses the existing localStorage
behavior. The game never breaks; it just isn't shared in that environment.

## Provisioning (one-time, manual by Rob)

In the Vercel dashboard: Storage → create a KV / Upstash Redis store → connect it
to the `owner-rpg` project. Vercel auto-injects the REST URL + token env vars.
Redeploy so the function picks them up. `@upstash/redis` is already a dependency.
No other config. Until a store is connected, `/api/scores` returns 503 and the app
falls back to localStorage (so previews/local dev still work).

## Out of scope (YAGNI)

- Auth / player accounts.
- Anti-abuse beyond basic input validation (internal-ish game).
- Standalone test harness (repo has none today); verify behaviorally + a manual
  API check.
