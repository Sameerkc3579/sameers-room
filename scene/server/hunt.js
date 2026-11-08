// The puzzle hunt's hall of solvers (Letter.tsx). The clues live in the room; the last one gives a word to type into
// SameerOS's terminal (`unlock <word>`), which opens the hidden letter. Solvers can then sign the hall here.
// The answer is checked again on this side, so only people who solved it can sign. Storage is the guestbook's
// Upstash Redis (./redis.js); without it the dev server keeps names in memory and production answers 503.

import { allow, hasRedis, json, redis, visitor } from './redis.js'
import { LINK, clean, rude } from './guestbook.js'

const ANSWER = 'sprout'
const KEY = 'hunt:solvers' // a Redis list, in the order people solved it
export const SHOWN = 100
const MAX_NAME = 24

const mem = { solvers: [] }
const store = {
  ready: () => hasRedis() || process.env.GUESTBOOK_DEV === '1',
  async list() {
    if (!hasRedis()) return { solvers: mem.solvers.slice(0, SHOWN), total: mem.solvers.length }
    const [rows, total] = await redis(['LRANGE', KEY, 0, SHOWN - 1], ['LLEN', KEY])
    return { solvers: rows.map((s) => JSON.parse(s)), total }
  },
  /** adds a solver and returns their place in the hall (1 = first ever) */
  async add(entry) {
    if (!hasRedis()) return mem.solvers.push(entry)
    const [n] = await redis(['RPUSH', KEY, JSON.stringify(entry)])
    return n
  },
}

export const solved = (answer) => String(answer ?? '').trim().toLowerCase() === ANSWER

const offline = () => json({ error: 'The hall of solvers isn’t connected yet.' }, 503)

export async function list() {
  if (!store.ready()) return offline()
  return json(await store.list(), 200, { 'Cache-Control': 'no-store' })
}

export async function post(req) {
  if (!store.ready()) return offline()
  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  if (body?.website) return json({ ok: true }) // hidden field only bots fill in
  const who = visitor(req, 'hunt')
  if (!(await allow(`hunt:try:${who}`, 20, 600))) return json({ error: 'Too many tries. Take a break and come back.' }, 429)
  if (!solved(body?.answer)) return json({ error: 'That’s not the word. Solve the hunt first!' }, 403)
  const name = clean(body?.name, MAX_NAME)
  if (name.length < 2) return json({ error: 'Write your name first.' }, 422)
  if (LINK.test(name)) return json({ error: 'Just a name, please, no links.' }, 422)
  if (rude(name)) return json({ error: 'Let’s keep the hall friendly. Try a different name?' }, 422)
  if (!(await allow(`hunt:sign:${who}`, 3, 86400))) return json({ error: 'You’ve signed the hall already today.' }, 429)
  const entry = { name, at: new Date().toISOString() }
  const rank = await store.add(entry)
  return json({ rank, entry }, 201)
}
