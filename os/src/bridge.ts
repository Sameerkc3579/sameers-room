// Messages between SameerOS (in an iframe on the 3D monitor) and the room scene around it.
// See DESIGN.md §5. When the OS runs standalone (the 2D version), sending is a no-op.
import { useOS } from './store'
import { lofi } from './audio/lofi'
import type { AppId } from './apps/meta'
import { allProjects } from './content/projects'

export const embedded = window.parent !== window

type OutMsg =
  | { type: 'os:hello' }
  | { type: 'os:ready' }
  | { type: 'os:shutdown' }
  | { type: 'os:sound'; on: boolean }
  | { type: 'os:music-state'; playing: boolean; track: string }
  | { type: 'os:unlock'; id: string; word: string }

type InMsg =
  | { type: 'os:open'; app: AppId; id?: string }
  | { type: 'os:skipBoot' }
  | { type: 'os:sound'; on: boolean }
  | { type: 'os:music'; action: 'toggle' | 'next' | 'prev' }
  | { type: 'os:unlock-result'; id: string; ok: boolean }

export function send(msg: OutMsg) {
  if (embedded) window.parent.postMessage(msg, window.location.origin)
}

export function openProject(id: string) {
  const p = allProjects.find((x) => x.id === id)
  if (p) useOS.getState().open('project', { id }, { key: `project-${id}`, title: p.name })
}

const asked = new Map<string, (ok: boolean | null) => void>()
/** The puzzle hunt's `unlock <word>`: the room checks the word (scene/src/hunt.ts). Resolves to null when there's no
 * room around the OS (the 2D version) or it doesn't answer. */
export function unlock(word: string): Promise<boolean | null> {
  if (!embedded) return Promise.resolve(null)
  const id = Math.random().toString(36).slice(2)
  return new Promise((resolve) => {
    asked.set(id, resolve)
    send({ type: 'os:unlock', id, word })
    setTimeout(() => asked.delete(id) && resolve(null), 4000)
  })
}

export function listen() {
  const onMessage = (e: MessageEvent<InMsg>) => {
    if (e.origin !== window.location.origin || !e.data?.type) return
    const os = useOS.getState()
    switch (e.data.type) {
      case 'os:open':
        if (e.data.app === 'project' && e.data.id) openProject(e.data.id)
        else os.open(e.data.app)
        break
      case 'os:skipBoot':
        if (os.phase !== 'desktop') os.setPhase('desktop')
        break
      case 'os:sound':
        os.setSound(e.data.on)
        break
      case 'os:unlock-result':
        asked.get(e.data.id)?.(e.data.ok)
        asked.delete(e.data.id)
        break
      case 'os:music':
        if (e.data.action === 'toggle') lofi.toggle()
        else if (e.data.action === 'next') lofi.next()
        else lofi.prev()
        break
    }
  }
  window.addEventListener('message', onMessage)
  send({ type: 'os:hello' }) // tells the scene it can start sending messages
  // keep the room's "now playing" chip in sync with the player
  const unsub = lofi.subscribe(() => send({ type: 'os:music-state', playing: lofi.playing, track: lofi.track.title }))
  return () => {
    window.removeEventListener('message', onMessage)
    unsub()
  }
}
