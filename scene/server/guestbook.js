// The guestbook behind the sticky notes (Guestbook.tsx): notes are public as soon as they pass the checks below.
//
// Storage is Upstash Redis over its REST API (no client library): connect it in Vercel → Storage → Upstash Redis,
// which sets KV_REST_API_URL / KV_REST_API_TOKEN (UPSTASH_REDIS_REST_* also work). Without those, the dev server
// keeps notes in memory and production answers 503 "not connected yet".
//
// Deleting: set GUESTBOOK_ADMIN_KEY in Vercel, then open the site with ?admin=<key> and use the × on a note.

import { randomUUID, timingSafeEqual } from 'node:crypto'
import { allow, hasRedis, json, redis, visitor } from './redis.js'

const KEY = 'guestbook:notes' // a Redis list, newest first
const KEEP = 500 // older notes fall off the end
export const SHOWN = 80
const LIMIT = { notes: 3, seconds: 600 } // per visitor
export const COLORS = ['yellow', 'sage', 'pink', 'blue']
export const MAX = { name: 24, text: 160 }

/* ---------- storage ---------- */

/** Dev only: notes live in memory while the dev server runs. */
const mem = { notes: [] }

const store = {
  ready: () => hasRedis() || process.env.GUESTBOOK_DEV === '1',
  async list(n) {
    if (!hasRedis()) return mem.notes.slice(0, n)
    const [rows] = await redis(['LRANGE', KEY, 0, n - 1])
    return rows.map((s) => JSON.parse(s))
  },
  async add(note) {
    if (!hasRedis()) return void mem.notes.unshift(note)
    await redis(['LPUSH', KEY, JSON.stringify(note)], ['LTRIM', KEY, 0, KEEP - 1])
  },
  async remove(id) {
    if (!hasRedis()) return void (mem.notes = mem.notes.filter((x) => x.id !== id))
    const [rows] = await redis(['LRANGE', KEY, 0, KEEP - 1])
    const hit = rows.find((s) => JSON.parse(s).id === id)
    if (hit) await redis(['LREM', KEY, 1, hit])
    return Boolean(hit)
  },
  /** counts this visitor's notes in the current window; true while under the limit */
  allow: (who) => allow(`guestbook:rl:${who}`, LIMIT.notes, LIMIT.seconds),
}

/* ---------- checks ---------- */

// Abuse in English and Hindi / Hinglish, checked word by word on a squashed copy (lower case, look-alike digits
// mapped back to letters, symbols dropped, repeated letters collapsed), so "f*u*c*k", "sh1t" and "chuuutiya" are
// caught. Distinctive words are caught anywhere inside a word ("motherfucker"); short ones only as a whole word,
// so "grape", "Sussex" and "randint" stay fine.
const INSIDE = [
  'fuck', 'bitch', 'nigger', 'nigga', 'faggot', 'asshole', 'chutiya', 'chutia', 'madarchod', 'madharchod',
  'behenchod', 'bhenchod', 'benchod', 'bhosdi', 'bhosad', 'gandu', 'jhatu', 'harami',
]
const WHOLE = [
  'shit', 'cunt', 'dick', 'pussy', 'slut', 'whore', 'bastard', 'retard', 'rape', 'porn', 'nude', 'sex', 'randi',
  'lund', 'lauda', 'lawda', 'loda', 'kutta', 'kamina', 'chod', 'tatti', 'gaand',
]
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' }
const squash = (s) =>
  s
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => LEET[c])
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1')
const INSIDE_SQ = INSIDE.map(squash)
const WHOLE_SQ = new Set(WHOLE.flatMap((w) => [squash(w), squash(w + 's')]))
/** "f u c k" written with spaces counts as one word */
const words = (s) =>
  s
    .split(/\s+/)
    .join(' ')
    .replace(/\b(\S) (?=\S\b)/g, '$1')
    .split(' ')
    .map(squash)
    .filter(Boolean)
export const rude = (s) => words(s).some((w) => WHOLE_SQ.has(w) || INSIDE_SQ.some((b) => w.includes(b)))
export const LINK = /(https?:\/\/|www\.|\.(com|net|org|io|in|xyz|ru|ly|me|co)\b|@\w+\.\w+)/i

/** one line of visitor text: no control or direction-override chars, single spaces, at most `n` long */
export const clean = (s, n) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)

/** Cleans up a submitted note, or explains (to the visitor) why it can't go up. */
export function check(body) {
  const name = clean(body?.name, MAX.name) || 'Anonymous'
  const text = clean(body?.text, MAX.text)
  const color = COLORS.includes(body?.color) ? body.color : COLORS[0]
  if (body?.website) return { error: 'spam' } // hidden field only bots fill in
  if (text.length < 2) return { error: 'Write a little something first.' }
  if (LINK.test(text) || LINK.test(name)) return { error: 'Links and emails can’t go on the wall, sorry.' }
  if (rude(name) || rude(text)) return { error: 'Let’s keep the wall friendly. Try different words?' }
  return { note: { id: randomUUID(), name, text, color, at: new Date().toISOString() } }
}

/* ---------- HTTP ---------- */

const isAdmin = (req) => {
  const want = process.env.GUESTBOOK_ADMIN_KEY ?? (process.env.GUESTBOOK_DEV === '1' ? 'dev' : '')
  const got = req.headers.get('x-admin-key') ?? ''
  return want.length >= 3 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want))
}

const offline = () => json({ error: 'The guestbook isn’t connected yet.' }, 503)

export async function list() {
  if (!store.ready()) return offline()
  return json({ notes: await store.list(SHOWN) }, 200, { 'Cache-Control': 'no-store' })
}

export async function post(req) {
  if (!store.ready()) return offline()
  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const { note, error } = check(body)
  if (error === 'spam') return json({ ok: true }) // let bots think it worked
  if (error) return json({ error }, 422)
  if (!(await store.allow(visitor(req, 'guestbook'))))
    return json({ error: 'That’s a few notes already. Try again in a little while.' }, 429)
  await store.add(note)
  return json({ note }, 201)
}

export async function remove(req) {
  if (!store.ready()) return offline()
  if (!isAdmin(req)) return json({ error: 'Not allowed' }, 403)
  const id = new URL(req.url).searchParams.get('id') ?? ''
  return json({ removed: await store.remove(id) })
}
