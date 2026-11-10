import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useScene } from './store'
import { useRoom } from './roomModel'
import { clockTexture, drawClock } from './clockTexture'
import { lite } from './device'
import { reached, useBuild } from './build'

/** stable pseudo-random number in [0, 1) for index i (keeps render pure) */
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const DESK = new THREE.Vector3(-0.6, 0.8, -0.45)
const GLOW = lite ? 2.2 : 1 // the one candle a phone keeps glows a little warmer

/** Candle flames: a warm point light each, gently flickering. */
function Candles() {
  const all = useRoom().candles
  // each light costs every pixel on a phone: there, only the candle on the desk by the diffuser keeps its light
  const candles = lite ? [...all].sort((a, b) => a.distanceTo(DESK) - b.distanceTo(DESK)).slice(0, 1) : all.slice(0, 3)
  const lights = useRef<(THREE.PointLight | null)[]>([])
  const seeds = useMemo(() => candles.map((_, i) => hash(i) * 100), [candles])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const lit = reached(useBuild.getState(), 'fixtures') ? 1 : 0 // (the replay lights them with the rest)
    lights.current.forEach((l, i) => {
      if (!l) return
      const s = seeds[i]
      l.intensity = lit * (0.32 + Math.sin(t * 9.3 + s) * 0.04 + Math.sin(t * 23.1 + s * 2) * 0.03 + Math.sin(t * 3.7 + s) * 0.03) * GLOW
    })
  })
  return (
    <>
      {candles.map((p, i) => (
        <pointLight
          key={i}
          ref={(l) => {
            lights.current[i] = l
          }}
          color="#ff9b45"
          intensity={0.32}
          distance={1.1}
          decay={2}
          position={[p.x, p.y + 0.01, p.z]}
        />
      ))}
    </>
  )
}

/** Soft mist rising from the humidifier: a few dozen big, faint sprites drifting up and fading. */
function Mist() {
  const { mist } = useRoom()
  const there = useBuild((s) => reached(s, 'setup')) // the replay (build.ts): no mist before the diffuser
  const N = 40
  const pts = useRef<THREE.Points>(null)
  const sprite = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grd.addColorStop(0, 'rgba(255,255,255,0.55)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  }, [])
  const state = useRef(Array.from({ length: N }, (_, i) => ({ age: hash(i), drift: hash(i + 99) * 6.28 })))
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    return g
  }, [])
  useFrame((_, dt) => {
    if (!pts.current) return
    const pos = pts.current.geometry.attributes.position as THREE.BufferAttribute
    state.current.forEach((s, i) => {
      s.age += dt / 3.2
      if (s.age > 1) {
        s.age = 0
        s.drift = Math.random() * 6.28
      }
      const h = s.age * 0.3
      pos.setXYZ(i, mist.x + Math.sin(s.drift + s.age * 3) * 0.04 * s.age, mist.y + h, mist.z + Math.cos(s.drift) * 0.03 * s.age)
    })
    pos.needsUpdate = true
  })
  return (
    <points ref={pts} geometry={geo} frustumCulled={false} visible={there}>
      <pointsMaterial map={sprite} size={0.06} sizeAttenuation transparent opacity={0.1} depthWrite={false} color="#f4f6f2" />
    </points>
  )
}

/** Desk clock shows the time in Raipur; LED strips, lamp and neon dim with the light switch. */
function Details() {
  const { scene, glow } = useRoom()
  const lightsOn = useScene((s) => s.lightsOn)
  const lit = useBuild((s) => reached(s, 'fixtures')) // the replay (build.ts) lights them with the rest
  const on = lightsOn && lit

  useLayoutEffect(() => {
    const face = scene.getObjectByName('DeskClock_Screen') as THREE.Mesh | undefined
    if (!face) return
    drawClock()
    face.material = new THREE.MeshBasicMaterial({ map: clockTexture, toneMapped: false })
    const id = setInterval(drawClock, 15_000)
    return () => clearInterval(id)
  }, [scene])

  useLayoutEffect(() => {
    glow.forEach(({ m, full }) => (m.emissiveIntensity = on ? full : full * 0.04))
  }, [on, glow])
  return null
}

export function Ambience() {
  return (
    <>
      <Candles />
      <Mist />
      <Details />
    </>
  )
}
