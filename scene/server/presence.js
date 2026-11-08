// Who else is in the room right now (Fireflies.tsx). Each open tab checks in every ~25 s with what it's looking at;
// anyone not heard from for 60 s has left. Everyone is anonymous: the room only learns a visitor's country (from
// Vercel's geo header) and which object they're at. Storage is one Redis hash on the guestbook's Upstash
// (./redis.js), 3 commands per check-in; without it the dev server keeps visitors in memory and production
// answers 503 (no fireflies).

import { createHash } from 'node:crypto'
import { hasRedis, json, redis, visitor } from './redis.js'

const KEY = 'presence'
const STALE = 60_000
const MAX = 300 // visitors tracked at once; past that, new ones just aren't shown to others
const SHOWN = 24
// tabs from one address that count, so one person can't fill the room with fake visitors (a school's wifi still
// shows a few)
const PER_IP = 3
// what a visitor can be "at": the room itself, the computer, or one of the objects it zooms to (store.ts)
const PLACES = new Set(['room', 'screen', 'books', 'quote', 'notebooks', 'guestbook', 'stats'])

const mem = new Map()
const store = {
  ready: () => hasRedis() || process.env.GUESTBOOK_DEV === '1',
  /** saves this visitor and returns everyone's entries */
  async beat(id, entry) {
    if (!hasRedis()) {
      if (entry) mem.set(id, JSON.stringify(entry))
      else mem.delete(id)
      return Object.fromEntries(mem)
    }
    if (!entry) return void (await redis(['HDEL', KEY, id]))
    const [, , all] = await redis(['HSET', KEY, id, JSON.stringify(entry)], ['EXPIRE', KEY, 3600], ['HGETALL', KEY])
    // HGETALL comes back as [field, value, field, value, ...]
    const out = {}
    for (let i = 0; i < all.length; i += 2) out[all[i]] = all[i + 1]
    return out
  },
  async drop(ids) {
    if (!ids.length) return
    if (!hasRedis()) return ids.forEach((id) => mem.delete(id))
    await redis(['HDEL', KEY, ...ids])
  },
}

const short = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10)

/** POST { tab, at } checks in and returns the others; { tab, leave: true } (sent as the page closes) checks out. */
export async function beat(req) {
  if (!store.ready()) return json({ error: 'Presence isn’t connected yet.' }, 503)
  let body
  try {
    body = JSON.parse(await req.text()) // sendBeacon posts text/plain
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const tab = String(body?.tab ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 16)
  if (tab.length < 6) return json({ error: 'Bad request' }, 400)
  const who = visitor(req, 'presence').slice(0, 12)
  const id = `${who}:${tab}`
  if (body.leave) {
    await store.beat(id, null)
    return json({ ok: true })
  }

  const at = PLACES.has(body.at) ? body.at : 'room'
  const c = (req.headers.get('x-vercel-ip-country') ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || null
  const now = Date.now()
  const all = await store.beat(id, { at, c, t: now })

  const stale = []
  const others = []
  const perIp = new Map()
  const entries = Object.entries(all)
  for (const [key, raw] of entries) {
    let e
    try {
      e = JSON.parse(raw)
    } catch {
      stale.push(key)
      continue
    }
    if (now - e.t > STALE) {
      stale.push(key)
      continue
    }
    if (key === id) continue
    const ip = key.split(':')[0]
    const n = perIp.get(ip) ?? 0
    perIp.set(ip, n + 1)
    if (n >= PER_IP || others.length >= SHOWN) continue
    others.push({ id: short(key), at: e.at, c: e.c })
  }
  await store.drop(stale)
  // too many tracked at once (or someone flooding it): forget this one again so the hash can't grow without end
  if (entries.length - stale.length > MAX) await store.drop([id])
  return json({ others, here: entries.length - stale.length }, 200, { 'Cache-Control': 'no-store' })
}
