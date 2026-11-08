// The puzzle hunt: a letter hidden in the room behind a chain of clues.
//   1. a sticky note on the monitor (pinned.ts) says "ls -a"
//   2. the terminal in SameerOS lists a hidden .hunt file, which points at the about-me book (os Terminal.tsx)
//   3. a Caesar cipher in that book's margin (InfoBooks.tsx): turn the lights off and look at the wall
//   4. numbers glow on the wall in the dark (HuntGlow.tsx): a=1, b=2… spells the word
//   5. `unlock <word>` in the terminal (osLink.ts) opens the letter and the hall of solvers (Letter.tsx)
// Only a hash of the word is shipped; the hall (server/hunt.js) checks the word itself.
import { create } from 'zustand'

const HASH = '7957bdf8ea97bea330a7e03361617f09d58f59a9db836ecac295571e45a6314e'
const SAVE = 'hunt'

export interface Solver {
  name: string
  at: string
}

interface Hunt {
  /** the word, once this browser has solved it (sent along when signing the hall) */
  word: string | null
  /** this browser's place in the hall, once signed */
  rank: number | null
  hall: { solvers: Solver[]; total: number; status: 'loading' | 'ready' | 'offline' | 'error' }
}

function load(): Pick<Hunt, 'word' | 'rank'> {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE) ?? '{}') as Partial<Hunt>
    return { word: s.word ?? null, rank: s.rank ?? null }
  } catch {
    return { word: null, rank: null }
  }
}

export const useHunt = create<Hunt>(() => ({ ...load(), hall: { solvers: [], total: 0, status: 'loading' } }))

useHunt.subscribe(({ word, rank }) => {
  try {
    localStorage.setItem(SAVE, JSON.stringify({ word, rank }))
  } catch {
    // storage blocked: the letter just has to be unlocked again next time
  }
})

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** `unlock <word>` from the terminal: true (and remembered) if it's the word. */
export async function unlock(raw: string) {
  const word = raw.trim().toLowerCase()
  try {
    if ((await sha256(word)) !== HASH) return false
  } catch {
    return false // no WebCrypto (plain http on a LAN address): can't check
  }
  useHunt.setState({ word })
  return true
}

export async function loadHall() {
  try {
    const r = await fetch('./api/hunt')
    if (r.status === 503) return useHunt.setState((s) => ({ hall: { ...s.hall, status: 'offline' } }))
    if (!r.ok) throw new Error(String(r.status))
    const { solvers, total } = (await r.json()) as { solvers: Solver[]; total: number }
    useHunt.setState({ hall: { solvers, total, status: 'ready' } })
  } catch {
    useHunt.setState((s) => ({ hall: { ...s.hall, status: 'error' } }))
  }
}

/** Signs the hall. Resolves to an error message for the visitor, or null when they're in. */
export async function signHall(name: string, website: string) {
  const { word } = useHunt.getState()
  try {
    const r = await fetch('./api/hunt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: word, name, website }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return (d.error as string) ?? 'Something went wrong. Try again?'
    if (d.rank)
      useHunt.setState((s) => ({
        rank: d.rank as number,
        hall: { ...s.hall, solvers: [...s.hall.solvers, d.entry as Solver], total: s.hall.total + 1 },
      }))
    return null
  } catch {
    return 'Couldn’t reach the hall. Check your connection?'
  }
}
