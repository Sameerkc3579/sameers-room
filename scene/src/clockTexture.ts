import * as THREE from 'three'
import { useOutside } from './raipur'

/** The desk clock's face: the room's time (Raipur's, or the hour picked on the dial), redrawn as it changes
 * (see Ambience.tsx). */
export const clockTexture = (() => {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 112
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = false
  return tex
})()

export function drawClock() {
  const g = (clockTexture.image as HTMLCanvasElement).getContext('2d')!
  g.fillStyle = '#2b3128'
  g.fillRect(0, 0, 256, 112)
  g.fillStyle = '#e8efd8'
  g.font = '600 72px "Segoe UI", system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const hour = useOutside.getState().hour
  const h = Math.floor(hour)
  const m = Math.floor((hour - h) * 60)
  // 12-hour and zero-padded ("07:24"), matching the clock on SameerOS
  g.fillText(`${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')}`, 128, 60)
  clockTexture.needsUpdate = true
}
