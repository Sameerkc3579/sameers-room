// Upstash Redis over its REST API (no client library), used by the guestbook and the puzzle hunt.
// Connect it in Vercel → Storage → Upstash Redis, which sets KV_REST_API_URL / KV_REST_API_TOKEN
// (UPSTASH_REDIS_REST_* also work). Without those, callers fall back to memory (dev) or switch themselves off.
import { createHash } from 'node:crypto'

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

export const hasRedis = () => Boolean(URL_ && TOKEN)

/** Runs Redis commands in one round trip and returns their results. */
export async function redis(...cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  })
  if (!r.ok) throw new Error(`redis ${r.status}`)
  const out = await r.json()
  const err = out.find((x) => x.error)
  if (err) throw new Error(`redis: ${err.error}`)
  return out.map((x) => x.result)
}

const memHits = new Map()
/**
 * Counts a hit on `key` in a window of `seconds`; true while the count is at most `max`.
 * Uses Redis when connected, otherwise memory (fine for the dev server, per-instance in production).
 */
export async function allow(key, max, seconds) {
  if (!hasRedis()) {
    const now = Date.now()
    const h = (memHits.get(key) ?? []).filter((t) => now - t < seconds * 1000)
    memHits.set(key, [...h, now])
    return h.length < max
  }
  const [n] = await redis(['INCR', key], ['EXPIRE', key, seconds, 'NX'])
  return n <= max
}

/** A stable, anonymous id for rate limiting: a hash of the visitor's IP (the IP itself is never stored). */
export function visitor(req, salt) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 24)
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
