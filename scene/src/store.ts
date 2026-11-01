import { create } from 'zustand'

export type View = 'room' | 'screen' | 'focus'

/** where the monitor's screen sits on the page when the camera arrives (the OS grows out of it) */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface SceneState {
  view: View
  /** in 'focus' view: which object's panel is open (books, quote, notebooks) */
  focus: string | null
  /** the project the projects book should show (the chat agent picks one); cleared when that book isn't open */
  page: string | null
  openProject: (id: string) => void
  /** every shader is compiled, so the room may start drawing (App.tsx: Precompile) */
  ready: boolean
  /** the room has drawn its first frames (the one-off shadow passes are done): the loader can go */
  shown: boolean
  /** the recruiter tour (tour.ts): which stop is showing, or null when there's no tour */
  tour: number | null
  /** the monitor's on-page rectangle when the camera reached it */
  screenRect: Rect | null
  setScreenRect: (r: Rect) => void
  /** where the focused object sits on the page when the camera arrives (the resume book rises from here) */
  focusPoint: { x: number; y: number } | null
  setFocusPoint: (p: { x: number; y: number }) => void
  /** camera has finished gliding to the monitor / the focused object */
  arrived: boolean
  /** the OS iframe is created on the first visit and then kept alive */
  osMounted: boolean
  hover: string | null
  /** LED strips, mushroom lamp and neon sign (the mushroom lamp toggles them) */
  lightsOn: boolean
  /** 'high' adds live ambient occlusion; chosen automatically from the measured frame rate */
  quality: 'high' | 'normal'
  /** lo-fi music state, reported by the OS */
  music: { playing: boolean; track: string }
  setView: (v: View, focus?: string) => void
  setArrived: (a: boolean) => void
  setHover: (h: string | null) => void
  toggleLights: () => void
  setQuality: (q: 'high' | 'normal') => void
  setMusic: (m: { playing: boolean; track: string }) => void
  /** create the OS iframe without zooming in (the headphones play music from it) */
  mountOS: () => void
  /** clickable objects the visitor has already used (their hint dots stop pulsing) */
  used: string[]
  markUsed: (key: string) => void
}

export const useScene = create<SceneState>((set) => ({
  view: 'room',
  focus: null,
  page: null,
  tour: null,
  ready: false,
  shown: false,
  openProject: (page) =>
    set((s) =>
      s.view === 'focus' && s.focus === 'books'
        ? { page }
        : { page, view: 'focus', focus: 'books', arrived: false, hover: null },
    ),
  screenRect: null,
  setScreenRect: (screenRect) => set({ screenRect }),
  focusPoint: null,
  setFocusPoint: (focusPoint) => set({ focusPoint }),
  arrived: false,
  osMounted: false,
  hover: null,
  lightsOn: true,
  quality: 'normal',
  music: { playing: false, track: '' },
  setView: (view, focus) =>
    set((s) => ({
      view,
      focus: view === 'focus' ? (focus ?? null) : null,
      page: view === 'focus' && focus === 'books' ? s.page : null,
      arrived: false,
      hover: null,
      osMounted: s.osMounted || view === 'screen',
    })),
  setArrived: (arrived) => set({ arrived }),
  setHover: (hover) => set({ hover }),
  toggleLights: () => set((s) => ({ lightsOn: !s.lightsOn })),
  setQuality: (quality) => set({ quality }),
  setMusic: (music) => set({ music }),
  mountOS: () => set({ osMounted: true }),
  used: [],
  markUsed: (key) => set((s) => (s.used.includes(key) ? s : { used: [...s.used, key] })),
}))

/** Phones and tablets get the OS as a fullscreen overlay instead of on the 3D screen (DESIGN.md §5). */
export const compactOS = () => window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches

/** Phones get books with a single page: the cover swings away instead of becoming the left page. */
export const singlePage = () => window.innerWidth < 760

/** Focus targets that open as a book (Books.tsx); the rest (stats) are just a closer look. */
export const BOOKS = ['notebooks', 'books', 'quote', 'guestbook', 'letter']
