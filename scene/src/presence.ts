// Who else is in the room right now. Each tab checks in with /api/presence (server/presence.js) every ~25 s and
// whenever it moves somewhere new, and gets back the other visitors; Fireflies.tsx turns each into a firefly
// drifting near what they're looking at. A tab that's hidden or left alone for a while stops checking in, and its
// firefly fades out for everyone else.
import { create } from 'zustand'
import { useScene } from './store'

export interface Visitor {
  id: string
  /** 'room', 'screen' or the object they've zoomed to */
  at: string
  /** two-letter country code, when the host knows it */
  c: string | null
}

interface Presence {
  others: Visitor[]
  status: 'loading' | 'ready' | 'offline'
}

export const usePresence = create<Presence>(() => ({ others: [], status: 'loading' }))

const EVERY = 25_000
const MOVED = 8_000 // after moving, check in again at most this often
const IDLE = 10 * 60_000 // no input for this long and the tab counts as gone

/** what each place reads as in a firefly's label */
export const DOING: Record<string, string> = {
  room: 'looking around the room',
  screen: 'using SameerOS',
  books: 'reading my projects',
  quote: 'reading about me',
  notebooks: 'reading my resume',
  guestbook: 'reading the guestbook',
  stats: 'checking my stats',
}

/** the same in Hindi, for the room in Hindi (i18n.ts) */
export const DOING_HI: Record<string, string> = {
  room: 'कमरे में घूम रहे हैं',
  screen: 'SameerOS चला रहे हैं',
  books: 'मेरे प्रोजेक्ट्स पढ़ रहे हैं',
  quote: 'मेरे बारे में पढ़ रहे हैं',
  notebooks: 'मेरा रिज़्यूमे पढ़ रहे हैं',
  guestbook: 'गेस्टबुक पढ़ रहे हैं',
  stats: 'मेरे आँकड़े देख रहे हैं',
}

const names: Partial<Record<'en' | 'hi', Intl.DisplayNames>> = {}
/** "Someone from India" ("भारत से कोई"), or just "Someone" */
export function someone(c: string | null, lang: 'en' | 'hi' = 'en') {
  const nobody = lang === 'hi' ? 'कोई' : 'Someone'
  try {
    names[lang] ??= new Intl.DisplayNames([lang], { type: 'region' })
    const n = c ? names[lang]!.of(c) : null
    if (!n || n === c) return nobody
    return lang === 'hi' ? `${n} से कोई` : `Someone from ${n}`
  } catch {
    return nobody
  }
}

function tabId() {
  try {
    let id = sessionStorage.getItem('presence-tab')
    if (!id) sessionStorage.setItem('presence-tab', (id = Math.random().toString(36).slice(2, 12)))
    return id
  } catch {
    return Math.random().toString(36).slice(2, 12)
  }
}

/** where this visitor is, as the others will see it (the hunt's places stay a secret: they read as the computer) */
function where() {
  const { view, focus } = useScene.getState()
  if (view === 'screen' || focus === 'letter' || focus === 'huntnote') return 'screen'
  if (view === 'focus' && focus && DOING[focus]) return focus
  return 'room'
}

let started = false
export function startPresence() {
  if (started) return
  started = true
  const tab = tabId()
  let last = 0
  let lastInput = Date.now()
  let timer = 0
  let stopped = false
  const active = () => document.visibilityState === 'visible' && Date.now() - lastInput < IDLE

  async function beat() {
    clearTimeout(timer)
    if (stopped) return
    if (active()) {
      last = Date.now()
      try {
        const r = await fetch('./api/presence', { method: 'POST', body: JSON.stringify({ tab, at: where() }) })
        if (r.status === 503 || r.status === 404) {
          stopped = true // no database (or an old deploy without the endpoint): nobody to see
          return usePresence.setState({ others: [], status: 'offline' })
        }
        if (r.ok) {
          const { others } = (await r.json()) as { others: Visitor[] }
          usePresence.setState({ others, status: 'ready' })
        }
      } catch {
        // offline for a moment: keep the fireflies we have and try again next time
      }
    } else usePresence.setState({ others: [] }) // away: we can't see who's here, so don't show stale fireflies
    timer = window.setTimeout(beat, EVERY)
  }

  // moving somewhere new tells the others soon after (once the visitor settles, not on every glide)
  let moved = 0
  let prev = where()
  useScene.subscribe(() => {
    const now = where()
    if (now === prev) return
    prev = now
    clearTimeout(moved)
    moved = window.setTimeout(beat, Math.max(1500, last + MOVED - Date.now()))
  })

  const wake = () => {
    const wasIdle = !active()
    lastInput = Date.now()
    if (wasIdle && document.visibilityState === 'visible') beat()
  }
  for (const e of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(e, wake, { passive: true })
  addEventListener('pointermove', () => (lastInput = Date.now()), { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wake()
  })
  // closing the tab takes the firefly away straight away instead of after a minute
  addEventListener('pagehide', () => {
    if (!stopped) navigator.sendBeacon?.('./api/presence', JSON.stringify({ tab, leave: true }))
  })
  beat()
}
