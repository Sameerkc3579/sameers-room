// Talks to SameerOS running in the monitor's iframe (protocol in DESIGN.md §5 and os/src/bridge.ts).
import { useScene } from './store'
import { unlock } from './hunt'

export type ToOS =
  | { type: 'os:open'; app: string; id?: string }
  | { type: 'os:skipBoot' }
  | { type: 'os:sound'; on: boolean }
  | { type: 'os:music'; action: 'toggle' | 'next' | 'prev' }
  | { type: 'os:unlock-result'; id: string; ok: boolean }

let target: Window | null = null
const queue: ToOS[] = []

/** Sends now if the OS has said hello, otherwise queues until it does. */
export function sendOS(msg: ToOS) {
  if (target) target.postMessage(msg, location.origin)
  else queue.push(msg)
}

window.addEventListener('message', (e) => {
  // (an iframe's window comes from another realm, so `instanceof Window` would be false; compare instead)
  const src = e.source as Window | null
  if (e.origin !== location.origin || !src || src === window) return
  switch (e.data?.type) {
    case 'os:hello': // the OS iframe introduces itself once its listener is up
      target = src
      queue.splice(0).forEach(sendOS)
      break
    case 'os:shutdown':
      useScene.getState().setView('room')
      break
    case 'os:unlock': {
      // the puzzle hunt's last step (hunt.ts): `unlock <word>` in the terminal
      const id = String(e.data.id ?? '')
      unlock(String(e.data.word ?? '')).then((ok) => {
        sendOS({ type: 'os:unlock-result', id, ok })
        if (ok) setTimeout(() => useScene.getState().setView('focus', 'letter'), 1800) // after the terminal has said so
      })
      break
    }
    case 'os:music-state':
      useScene.getState().setMusic({ playing: !!e.data.playing, track: String(e.data.track ?? '') })
      break
  }
})
