import { useEffect, useRef, useState } from 'react'
import { useScene, type Rect } from './store'
import { lite } from './device'

const OS_SRC = './os/index.html'
const PRELOAD_MS = 2500

type Phase = 'hidden' | 'start' | 'open' | 'closing'

/** CSS transform that squeezes the full-page layer onto `r` (the monitor's screen on the page). */
const onto = (r: Rect) =>
  `translate(${r.x}px, ${r.y}px) scale(${r.w / window.innerWidth}, ${r.h / window.innerHeight})`

/**
 * The live SameerOS, as a full-page layer above the room. It loads quietly in the background soon after the room
 * appears (so clicking the monitor never stalls), stays invisible until the camera has glided up to the monitor,
 * then grows out of the monitor's screen until it fills the page: you "enter" the computer. Going back shrinks it
 * into the screen again while the camera pulls out (CameraRig waits for that).
 */
export function OsLayer() {
  const mounted = useScene((s) => s.osMounted)
  const entered = useScene((s) => s.view === 'screen' && s.arrived)
  const rect = useScene((s) => s.screenRect)
  const [phase, setPhase] = useState<Phase>('hidden')
  const frame = useRef<HTMLIFrameElement>(null)

  // The hidden OS must not keep the keyboard: its sign-in button autofocuses when it loads in the background,
  // which would swallow Esc and the resume's zoom keys. Focus moving into the iframe blurs the page window.
  const open = useRef(false)
  useEffect(() => {
    open.current = phase === 'open'
  }, [phase])
  useEffect(() => {
    const onBlur = () =>
      setTimeout(() => {
        if (!open.current && document.activeElement === frame.current) {
          frame.current?.blur()
          window.focus()
        }
      })
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])

  // preload: create the OS a moment after the room is up
  useEffect(() => {
    if (lite) return // phones: it loads when the monitor is tapped, rather than running hidden in the background
    const t = setTimeout(() => useScene.getState().mountOS(), PRELOAD_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let raf = 0
    let timer = 0
    if (entered) {
      raf = requestAnimationFrame(() => {
        setPhase('start') // drawn exactly over the monitor's screen…
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() => {
            open.current = true // before focusing, so the focus guard above lets it through
            setPhase('open') // …then expands to the whole page
            frame.current?.focus()
          })
        })
      })
    } else {
      raf = requestAnimationFrame(() => setPhase((p) => (p === 'open' || p === 'start' ? 'closing' : p)))
      timer = window.setTimeout(() => setPhase((p) => (p === 'closing' ? 'hidden' : p)), 350)
    }
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [entered])

  if (!mounted) return null
  const atScreen = phase !== 'open' && rect
  return (
    <div
      className={`os-layer ${phase}`}
      style={{ transform: atScreen ? onto(rect) : 'none' }}
      aria-hidden={phase !== 'open'}
    >
      <iframe ref={frame} title="SameerOS" src={OS_SRC} allow="autoplay" tabIndex={phase === 'open' ? 0 : -1} />
    </div>
  )
}
