import { create } from 'zustand'
import { APPS, type AppId } from './apps/meta'
import type { IconName } from './shell/icons'
import { setMuted } from './audio/ctx'

export type Phase = 'boot' | 'login' | 'welcome' | 'desktop' | 'off'

export interface Win {
  id: string
  app: AppId
  title: string
  icon: IconName
  props: Record<string, unknown>
  x: number
  y: number
  w: number
  h: number
  z: number
  min: boolean
  max: boolean
}

interface OpenOpts {
  title?: string
  icon?: IconName
  key?: string
  h?: number
}

interface OS {
  phase: Phase
  windows: Win[]
  activeId: string | null
  topZ: number
  startOpen: boolean
  /** power menu (was XP's 'Turn off computer' dialog) */
  turnOffOpen: boolean
  balloon: boolean
  sound: boolean

  setPhase: (p: Phase) => void
  open: (app: AppId, props?: Record<string, unknown>, opts?: OpenOpts) => void
  close: (id: string) => void
  focus: (id: string) => void
  minimize: (id: string) => void
  toggleMax: (id: string) => void
  setRect: (id: string, r: Partial<Pick<Win, 'x' | 'y' | 'w' | 'h'>>) => void
  setStartOpen: (v: boolean) => void
  setTurnOffOpen: (v: boolean) => void
  setBalloon: (v: boolean) => void
  setSound: (v: boolean) => void
  closeAll: () => void
}

export const TASKBAR_H = 76 // space the dock occupies at the bottom
export const isSmall = () => window.innerWidth < 700

const topVisible = (wins: Win[]) =>
  wins.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0]?.id ?? null

let seq = 0

export const useOS = create<OS>((set, get) => ({
  phase: 'boot',
  windows: [],
  activeId: null,
  topZ: 10,
  startOpen: false,
  turnOffOpen: false,
  balloon: false,
  sound: true,

  setPhase: (phase) => set({ phase, startOpen: false, turnOffOpen: false }),

  open: (app, props = {}, opts = {}) => {
    const meta = APPS[app]
    const key = opts.key ?? (meta.multi ? `${app}-${++seq}` : app)
    const existing = get().windows.find((w) => w.id === key)
    set({ startOpen: false })
    if (existing) {
      get().focus(key)
      return
    }
    const vw = window.innerWidth
    const vh = window.innerHeight - TASKBAR_H
    const w = Math.min(meta.w, vw - 8)
    const h = Math.min(opts.h ?? meta.h, vh - 8)
    const n = get().windows.filter((x) => x.app !== 'message').length % 6
    const centred = app === 'message'
    const x = centred ? (vw - w) / 2 : Math.max(0, Math.min(130 + n * 28, vw - w - 4))
    const y = centred ? (vh - h) / 2.5 : Math.max(0, Math.min(36 + n * 28, vh - h - 4))
    const z = get().topZ + 1
    const win: Win = {
      id: key,
      app,
      title: opts.title ?? meta.title,
      icon: opts.icon ?? meta.icon,
      props,
      x,
      y,
      w,
      h,
      z,
      min: false,
      max: isSmall() && app !== 'message',
    }
    set((s) => ({ windows: [...s.windows, win], topZ: z, activeId: key }))
  },

  close: (id) =>
    set((s) => {
      const windows = s.windows.filter((w) => w.id !== id)
      return { windows, activeId: topVisible(windows) }
    }),

  focus: (id) =>
    set((s) => {
      if (s.activeId === id && !s.windows.find((w) => w.id === id)?.min) return s
      const z = s.topZ + 1
      return {
        topZ: z,
        activeId: id,
        windows: s.windows.map((w) => (w.id === id ? { ...w, z, min: false } : w)),
      }
    }),

  minimize: (id) =>
    set((s) => {
      const windows = s.windows.map((w) => (w.id === id ? { ...w, min: true } : w))
      return { windows, activeId: topVisible(windows) }
    }),

  toggleMax: (id) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, max: !w.max } : w)) })),

  setRect: (id, r) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...r } : w)) })),

  setStartOpen: (startOpen) => set({ startOpen }),
  setTurnOffOpen: (turnOffOpen) => set({ turnOffOpen, startOpen: false }),
  setBalloon: (balloon) => set({ balloon }),
  setSound: (sound) => {
    setMuted(!sound)
    set({ sound })
  },
  closeAll: () => set({ windows: [], activeId: null }),
}))

/** Shorthand for a message box. */
export const alertBox = (text: string, opts: { title?: string; icon?: 'info' | 'warning' | 'error' } = {}) => {
  // grow with the text: ~44 characters per line in a 360px box
  const lines = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 44)), 0)
  const title = opts.title ?? 'SameerOS'
  useOS.getState().open('message', { text, kind: opts.icon ?? 'info' }, { title, h: 110 + lines * 16 })
}
