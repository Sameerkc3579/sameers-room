// Live data the room shows: coding stats on the pegboard and the guestbook's sticky notes.
// Both come from the site's own functions (scene/api): /api/stats and /api/notes.
import { create } from 'zustand'

/* ---------- stats (server/stats.js) ---------- */

export interface Stats {
  updated: string
  leetcode: { user: string; solved: number; easy: number; medium: number; hard: number } | null
  codeforces: { user: string; solved: number } | null
  github: { user: string; total: number; days: { date: string; level: number; count: number }[] } | null
}

export const useStats = create<{ stats: Stats | null }>(() => ({ stats: null }))

/** Live numbers from /api/stats, or the snapshot taken at build time (public/stats.json) if that fails. */
export async function loadStats() {
  for (const url of ['./api/stats', './stats.json']) {
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const stats = (await r.json()) as Stats
      if (stats.leetcode || stats.codeforces || stats.github) return useStats.setState({ stats })
    } catch {
      // try the next source
    }
  }
}

export const solvedTotal = (s: Stats | null) => (s?.leetcode?.solved ?? 0) + (s?.codeforces?.solved ?? 0)
/** Sameer has also solved problems on sites we can't read live, so the headline is his own 700+ until the two live
 * counts alone pass it. */
const ALL_SITES = 700
export const solvedText = (s: Stats | null) => (solvedTotal(s) > ALL_SITES ? String(solvedTotal(s)) : `${ALL_SITES}+`)

/* ---------- guestbook (server/guestbook.js) ---------- */

export type NoteColor = 'yellow' | 'sage' | 'pink' | 'blue'
export interface Note {
  id: string
  name: string
  text: string
  color: NoteColor
  at: string
}
export const NOTE_COLORS: Record<NoteColor, string> = {
  yellow: '#f8e08e',
  sage: '#cfe0bf',
  pink: '#f6c9c4',
  blue: '#c7dcef',
}
export const LIMITS = { name: 24, text: 160 }

interface Notes {
  notes: Note[]
  /** 'offline' = the guestbook has no database yet (see server/guestbook.js) */
  status: 'loading' | 'ready' | 'offline' | 'error'
  /** the delete key from ?admin=…, kept for this tab only */
  admin: string | null
}

export const useNotes = create<Notes>(() => ({ notes: [], status: 'loading', admin: readAdmin() }))

/** ?admin=<key> turns on the × on each note; the key is moved out of the address bar straight away. */
function readAdmin() {
  try {
    const url = new URL(location.href)
    const key = url.searchParams.get('admin')
    if (key) {
      sessionStorage.setItem('guestbook-admin', key)
      url.searchParams.delete('admin')
      history.replaceState(null, '', url)
    }
    return sessionStorage.getItem('guestbook-admin')
  } catch {
    return null
  }
}

export async function loadNotes() {
  try {
    const r = await fetch('./api/notes')
    if (r.status === 503) return useNotes.setState({ status: 'offline' })
    if (!r.ok) throw new Error(String(r.status))
    const { notes } = (await r.json()) as { notes: Note[] }
    useNotes.setState({ notes, status: 'ready' })
  } catch {
    useNotes.setState({ status: 'error' })
  }
}

/** Pins a note. Resolves to an error message for the visitor, or null when it's up. */
export async function postNote(n: { name: string; text: string; color: NoteColor; website: string }) {
  try {
    const r = await fetch('./api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return (d.error as string) ?? 'Something went wrong. Try again?'
    if (d.note) {
      remember(d.note.id)
      useNotes.setState((s) => ({ notes: [d.note as Note, ...s.notes] }))
    }
    return null
  } catch {
    return 'Couldn’t reach the guestbook. Check your connection?'
  }
}

/** Notes written in this browser, so the vine (Vine.tsx) can say "your leaf". */
const MINE = 'guestbook-mine'
function remember(id: string) {
  try {
    localStorage.setItem(MINE, JSON.stringify([...mine(), id].slice(-20)))
  } catch {
    // storage blocked: the leaf just shows the name
  }
}
function mine(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MINE) ?? '[]') as string[]
  } catch {
    return []
  }
}
export const isMine = (id: string) => mine().includes(id)

export async function deleteNote(id: string) {
  const { admin } = useNotes.getState()
  if (!admin) return
  const r = await fetch(`./api/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-admin-key': admin } })
  if (r.ok) useNotes.setState((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
}
