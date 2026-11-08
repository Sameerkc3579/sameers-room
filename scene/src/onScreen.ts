import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const MARGIN = 8

/**
 * Keeps a label that drei's <Html> pins to a 3D point fully on screen. Portrait phones see only part of the room,
 * so a label on something near the edge (a leaf at the end of the vine) would be cut off; this slides it back in.
 * The label's own React tree can't reach the scene, so this runs in the component that owns the <Html>.
 */
export function useOnScreen() {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef<HTMLDivElement | null>(null)
  const nudge = useRef({ x: 0, y: 0 })
  useFrame(() => {
    const el = ref.current
    if (el !== last.current) {
      last.current = el
      nudge.current = { x: 0, y: 0 }
    }
    if (!el) return
    const r = el.getBoundingClientRect()
    const n = nudge.current
    // where it would sit without the nudge
    const left = r.left - n.x
    const right = r.right - n.x
    const top = r.top - n.y
    const bottom = r.bottom - n.y
    const x = Math.round(left < MARGIN ? MARGIN - left : right > innerWidth - MARGIN ? innerWidth - MARGIN - right : 0)
    const y = Math.round(top < MARGIN ? MARGIN - top : bottom > innerHeight - MARGIN ? innerHeight - MARGIN - bottom : 0)
    if (x === n.x && y === n.y) return
    nudge.current = { x, y }
    el.style.transform = x || y ? `translate(${x}px, ${y}px)` : ''
  })
  return ref
}
