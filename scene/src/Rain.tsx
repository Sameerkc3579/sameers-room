import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useOutside } from './raipur'

// the air just outside the window on the left wall (blender/build_room.py: window at x -1.5, sill at y 0.95)
const BOX = { x0: -3.4, x1: -1.62, y0: 0.7, y1: 2.7, z0: -0.95, z1: 0.75 }
const N = 600
const SPEED = 7.5 // m/s
const LEN = 0.13 // streak length
const SLANT = 0.18 // a little wind
/** stable pseudo-random number in [0, 1) for index i (keeps render pure) */
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Rain falling past the window whenever it's raining in Raipur (raipur.ts). Heavier in a thunderstorm. */
export function Rain() {
  const sky = useOutside((s) => s.sky)
  const night = useOutside((s) => s.day < 0.3)
  if (sky !== 'rain' && sky !== 'storm') return null
  const count = sky === 'storm' ? N : Math.round(N * 0.6)
  return <Drops key={count} count={count} night={night} />
}

function Drops({ count, night }: { count: number; night: boolean }) {
  const lines = useRef<THREE.LineSegments>(null)
  const drops = useRef(
    Array.from({ length: count }, (_, i) => ({
      x: BOX.x0 + hash(i) * (BOX.x1 - BOX.x0),
      y: BOX.y0 + hash(i + 1000) * (BOX.y1 - BOX.y0),
      z: BOX.z0 + hash(i + 2000) * (BOX.z1 - BOX.z0),
      v: SPEED * (0.8 + hash(i + 3000) * 0.4),
    })),
  )
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3))
    return g
  }, [count])

  useFrame((_, dt) => {
    if (!lines.current) return
    const pos = lines.current.geometry.attributes.position as THREE.BufferAttribute
    const step = Math.min(dt, 0.05)
    drops.current.forEach((d, i) => {
      d.y -= d.v * step
      d.z += d.v * SLANT * step
      if (d.y < BOX.y0) {
        d.y = BOX.y1
        d.z = BOX.z0 + ((d.z - BOX.z0 + 0.61803) % 1) * (BOX.z1 - BOX.z0)
      }
      pos.setXYZ(i * 2, d.x, d.y, d.z)
      pos.setXYZ(i * 2 + 1, d.x, d.y + LEN, d.z - LEN * SLANT)
    })
    pos.needsUpdate = true
  })

  return (
    <lineSegments ref={lines} geometry={geo} frustumCulled={false}>
      <lineBasicMaterial color={night ? '#9aa8c0' : '#dfe6ec'} transparent opacity={night ? 0.22 : 0.3} depthWrite={false} />
    </lineSegments>
  )
}
