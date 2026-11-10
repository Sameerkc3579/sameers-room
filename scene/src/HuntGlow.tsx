// The puzzle hunt's last clue (hunt.ts): numbers in glow-in-the-dark paint on the wall left of the monitor. They
// only show while the room's lights are off.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { useScene } from './store'
import { useBuild } from './build'

const WALL_Z = -0.7475 // the back wall (blender/build_room.py: WALL_Z -0.75)
const GLOW = '#b4ffc8'
const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive'

function paint() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 480
  const g = c.getContext('2d')!
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  // a faint dark rim so the paint still reads on a sunlit wall, then the glowing fill
  const write = (text: string, y: number, size: number, weight: number) => {
    g.font = `${weight} ${size}px ${HAND}`
    const w = g.measureText(text).width
    if (w > 900) g.font = `${weight} ${Math.floor((size * 900) / w)}px ${HAND}` // handwriting fonts run wide
    g.shadowBlur = 0
    g.lineWidth = 10
    g.strokeStyle = 'rgba(25, 70, 40, 0.5)'
    g.strokeText(text, 512, y)
    g.shadowColor = 'rgba(160, 255, 190, 0.95)'
    g.shadowBlur = 22
    g.fillStyle = '#fff'
    g.fillText(text, 512, y)
  }
  write('19 · 16 · 18 · 15 · 21 · 20', 190, 96, 700)
  write('unlock  _ _ _ _ _ _', 345, 60, 600)
  // a few glow stars, like the stickers on a kid's ceiling
  g.shadowBlur = 14
  g.fillStyle = '#fff'
  const star = (x: number, y: number, r: number) => {
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2
      const d = i % 2 ? r * 0.45 : r
      g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
    }
    g.closePath()
    g.fill()
  }
  star(110, 70, 26)
  star(930, 92, 20)
  star(880, 410, 15)
  star(150, 400, 18)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function HuntGlow() {
  // (the replay's lights-off moment, build.ts, isn't a time to hand out clues)
  const lightsOn = useScene((s) => s.lightsOn) || useBuild.getState().at !== null
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const map = useMemo(() => paint(), [])

  // the paint takes a moment to "charge up" once it's dark, and fades as soon as the lights come back
  useFrame((_, dt) => {
    const m = mat.current
    if (!m || !mesh.current) return
    easing.damp(m, 'opacity', lightsOn ? 0 : 1, lightsOn ? 0.15 : 0.9, dt)
    mesh.current.visible = m.opacity > 0.01
  })

  return (
    <mesh ref={mesh} name="Hunt_Glow" position={[-0.55, 1.43, WALL_Z + 0.002]} rotation={[0, 0, THREE.MathUtils.degToRad(-3)]} visible={false}>
      <planeGeometry args={[0.42, 0.197]} />
      <meshBasicMaterial ref={mat} map={map} color={GLOW} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
