// Leaderboard data source. Talks to the shared /api/scores endpoint, and falls
// back to per-browser localStorage when the API is unreachable or the store
// isn't configured (local `vite dev`, preview deploys without KV connected).

const API = '/api/scores'
const STORAGE_KEY = 'owner-rpg-highscores-v2'
const MAX_DISPLAY = 5
const MAX_KEEP = 50

function currentMonthLabel() {
  return new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
}

// ---- localStorage fallback ----

function readLocalScores() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data).scores || []
  } catch {
    return []
  }
}

function localLeaderboard() {
  const all = readLocalScores()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthly = all
    .filter((entry) => {
      if (!entry.date) return false
      const d = new Date(entry.date)
      return d.getFullYear() === year && d.getMonth() === month
    })
    .slice(0, MAX_DISPLAY)
  return {
    allTime: all.slice(0, MAX_DISPLAY),
    monthly,
    monthLabel: currentMonthLabel(),
  }
}

function addLocalScore(initials, score) {
  const all = readLocalScores()
  all.push({ initials, score, date: new Date().toISOString() })
  all.sort((a, b) => b.score - a.score)
  const trimmed = all.slice(0, MAX_KEEP)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scores: trimmed }))
  } catch {
    // storage full / unavailable — nothing more we can do
  }
  return localLeaderboard()
}

// ---- normalization ----

function normalize(data) {
  return {
    allTime: Array.isArray(data?.allTime) ? data.allTime : [],
    monthly: Array.isArray(data?.monthly) ? data.monthly : [],
    monthLabel: data?.monthLabel || currentMonthLabel(),
  }
}

// ---- public API ----

export async function fetchLeaderboard() {
  try {
    const res = await fetch(API)
    if (!res.ok) throw new Error(`status ${res.status}`)
    return normalize(await res.json())
  } catch {
    return localLeaderboard()
  }
}

export async function submitScore(initials, score) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initials, score }),
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    return normalize(await res.json())
  } catch {
    return addLocalScore(initials, score)
  }
}

// Synchronous check against an already-fetched all-time list, used to decide
// whether to prompt for initials.
export function qualifiesForHighScore(score, allTime) {
  if (!Array.isArray(allTime) || allTime.length < MAX_DISPLAY) return score > 0
  return score > allTime[allTime.length - 1].score
}
