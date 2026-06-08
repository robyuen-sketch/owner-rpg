import { Redis } from '@upstash/redis'

// Shared all-time + monthly leaderboard, backed by Upstash Redis sorted sets.
// Reads env vars injected by Vercel KV (KV_REST_API_*) or the Upstash Marketplace
// integration (UPSTASH_REDIS_REST_*). If neither is present we throw, and the
// client falls back to localStorage.

const ALLTIME_KEY = 'rpg:alltime'
const TOP_N = 5
const MAX_SCORE = 1_000_000 // generous ceiling; real games top out ~300k
const MAX_KEEP = 100 // trim each set so it can't grow unbounded

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('leaderboard store not configured')
  }
  return new Redis({ url, token })
}

function monthKey(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `rpg:month:${y}-${m}`
}

function monthLabel(d) {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function sanitizeInitials(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
}

function parseMember(member) {
  if (member && typeof member === 'object') return member
  try {
    return JSON.parse(member)
  } catch {
    return null
  }
}

// Returns top-N entries [{ initials, score, date }] in descending score order.
async function topN(redis, key) {
  const raw = await redis.zrange(key, 0, TOP_N - 1, { rev: true, withScores: true })
  const out = []
  for (let i = 0; i < raw.length; i += 2) {
    const member = parseMember(raw[i])
    const score = Number(raw[i + 1])
    if (member && Number.isFinite(score)) {
      out.push({ initials: member.initials, score, date: member.date })
    }
  }
  return out
}

export default async function handler(req, res) {
  let redis
  try {
    redis = getRedis()
  } catch {
    return res.status(503).json({ error: 'leaderboard unavailable' })
  }

  const now = new Date()
  const mKey = monthKey(now)

  try {
    if (req.method === 'GET') {
      const [allTime, monthly] = await Promise.all([
        topN(redis, ALLTIME_KEY),
        topN(redis, mKey),
      ])
      return res.status(200).json({ allTime, monthly, monthLabel: monthLabel(now) })
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string' ? parseMember(req.body) || {} : req.body || {}
      const initials = sanitizeInitials(body.initials)
      let score = Math.floor(Number(body.score))

      if (!initials) {
        return res.status(400).json({ error: 'initials required' })
      }
      if (!Number.isFinite(score) || score < 0) {
        return res.status(400).json({ error: 'invalid score' })
      }
      score = Math.min(score, MAX_SCORE)

      const member = JSON.stringify({
        id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        initials,
        date: now.toISOString(),
      })

      await Promise.all([
        redis.zadd(ALLTIME_KEY, { score, member }),
        redis.zadd(mKey, { score, member }),
      ])
      // Drop everything below the top MAX_KEEP so the sets stay bounded.
      await Promise.all([
        redis.zremrangebyrank(ALLTIME_KEY, 0, -(MAX_KEEP + 1)),
        redis.zremrangebyrank(mKey, 0, -(MAX_KEEP + 1)),
      ])

      const [allTime, monthly] = await Promise.all([
        topN(redis, ALLTIME_KEY),
        topN(redis, mKey),
      ])
      return res.status(200).json({ allTime, monthly, monthLabel: monthLabel(now) })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method not allowed' })
  } catch {
    return res.status(500).json({ error: 'leaderboard unavailable' })
  }
}
