// Some phones drop the click that should follow a tap: a finger wobbles a few pixels (inside a scrolling page that
// can start a scroll and cancel the tap), or the page was busy drawing the room when the finger lifted. The tap then
// does nothing at all (a book's Close, a project in the list). So on a touch screen, a quick tap on a button or link
// that gets no click soon after is clicked here instead. The hint dots handle their own taps (Hints.tsx), and the
// room's canvas has its own swipe handling.
import { touch } from './device'

const WOBBLE = 20 // px a finger may drift and still count as a tap
const QUICK = 700 // ms: a longer press is a hold or a slow drag, not a tap
const WAIT = 350 // ms to wait for the browser's own click

let down: { id: number; x: number; y: number; at: number; el: HTMLElement } | null = null
let clicked = false

if (touch) {
  document.addEventListener(
    'touchstart',
    (e) => {
      const t = e.changedTouches[0]
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('button, a[href]')
      down =
        e.touches.length === 1 && el && !el.closest('.hint-layer')
          ? { id: t.identifier, x: t.clientX, y: t.clientY, at: e.timeStamp, el }
          : null
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'touchend',
    (e) => {
      const d = down
      down = null
      const t = d && [...e.changedTouches].find((c) => c.identifier === d.id)
      if (!d || !t || e.timeStamp - d.at > QUICK || Math.hypot(t.clientX - d.x, t.clientY - d.y) > WOBBLE) return
      clicked = false
      window.setTimeout(() => {
        // the browser clicked something after all, or the button is gone or switched off by then
        if (clicked || !d.el.isConnected || (d.el as HTMLButtonElement).disabled) return
        d.el.click()
      }, WAIT)
    },
    { capture: true, passive: true },
  )
  document.addEventListener('click', () => (clicked = true), true)
}
