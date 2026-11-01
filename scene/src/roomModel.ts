import { useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { ANCHORS, keyOf } from './interactables'
import { addPinned } from './pinned'
import { cheap, type RoomMaterial } from './lite'
import { lite } from './device'

const MODEL = './models/room.glb'
useGLTF.preload(MODEL)

export interface ScreenRect {
  center: THREE.Vector3
  width: number
  height: number
}

export interface LightStrip {
  center: THREE.Vector3
  width: number
}

export interface RoomInfo {
  scene: THREE.Group
  screen: ScreenRect
  /** bulb of the mushroom lamp */
  lamp: THREE.Vector3
  candles: THREE.Vector3[]
  leds: LightStrip[]
  mist: THREE.Vector3
  neon: THREE.Vector3
  /** where each clickable object's hint marker sits: just above its top, toward the viewer */
  anchors: Record<string, THREE.Vector3>
  /** materials that glow while the lights are on (LED strips, lamp, neon), with their full strength */
  glow: { m: RoomMaterial; full: number }[]
}

/** Objects carry an optional `tint` (glTF extras) that recolours their scanned textures, e.g. sage pots. */
function tintOf(o: THREE.Object3D) {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n.userData?.tint) return n.userData.tint as string
  return null
}

/** The loaded room (materials prepared once) plus positions the lights and effects hang off. */
export function useRoom(): RoomInfo {
  const { scene } = useGLTF(MODEL)
  const osTex = useTexture('./textures/os_screen.jpg', (t) => {
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = false // glTF UVs expect unflipped textures
    t.anisotropy = 8
  })

  return useMemo(() => {
    const glow: RoomInfo['glow'] = []
    const seen = new Set<THREE.Material>()
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.prepared) return
      o.userData.prepared = true
      o.castShadow = true
      o.receiveShadow = true
      const tint = tintOf(o)
      const own = tint || keyOf(o) // tinted and clickable objects get their own material copies
      if (own) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone()
      o.material = Array.isArray(o.material) ? o.material.map(cheap) : cheap(o.material) // phones: matte (lite.ts)

      for (const m of [o.material].flat() as RoomMaterial[]) {
        if (tint) m.color.multiply(new THREE.Color(tint))
        for (const t of ['map', 'normalMap', 'roughnessMap'] as const) {
          const tex = (m as Partial<Record<typeof t, THREE.Texture | null>>)[t]
          if (tex) tex.anisotropy = lite ? 2 : 8
        }
        if (m.name.startsWith('Glass')) {
          m.transparent = true
          m.opacity = o.name.startsWith('Glass_Window') ? 0.05 : 0.18
          m.depthWrite = false
          o.castShadow = false
        }
        if (/^(LedStrip|NeonTube|LampGlow)/.test(m.name) && !seen.has(m)) {
          seen.add(m)
          glow.push({ m, full: m.emissiveIntensity })
        }
        if (m.name.startsWith('Flame') || m.name.startsWith('LedStrip') || m.name.startsWith('NeonTube')) {
          o.castShadow = false
        }
      }
      if (o.name === 'Screen') o.material = new THREE.MeshBasicMaterial({ map: osTex, toneMapped: false })
      if (o.name.startsWith('Leaf') || o.name.startsWith('Vines')) o.castShadow = true
    })

    addPinned(scene) // stats card, GitHub graph and guestbook notes (pinned.ts)
    scene.updateMatrixWorld(true)
    const at = (name: string, fallback: THREE.Vector3) =>
      scene.getObjectByName(name)?.getWorldPosition(new THREE.Vector3()) ?? fallback
    const box = (name: string) => new THREE.Box3().setFromObject(scene.getObjectByName(name)!)

    const sb = box('Screen')
    const size = sb.getSize(new THREE.Vector3())
    const candles: THREE.Vector3[] = []
    scene.traverse((o) => {
      if (/^Candle_\d+$/.test(o.name)) candles.push(o.getWorldPosition(new THREE.Vector3()))
    })
    const leds = ['LED_Upper', 'LED_Lower'].map((n) => {
      const b = box(n)
      return { center: b.getCenter(new THREE.Vector3()), width: b.getSize(new THREE.Vector3()).x }
    })

    const anchors: Record<string, THREE.Vector3> = {}
    for (const [key, { name, at: where }] of Object.entries(ANCHORS)) {
      if (!scene.getObjectByName(name)) continue
      const b = box(name)
      const c = b.getCenter(new THREE.Vector3())
      anchors[key] =
        where === 'front'
          ? new THREE.Vector3(c.x, c.y - (b.max.y - c.y) * 0.45, b.max.z + 0.02)
          : new THREE.Vector3(c.x, b.max.y + 0.035, c.z + (b.max.z - c.z) * 0.6)
    }

    return {
      scene,
      anchors,
      screen: { center: sb.getCenter(new THREE.Vector3()), width: size.x, height: size.y },
      lamp: at('Lamp_Light', new THREE.Vector3(-0.47, 1.77, -0.65)),
      candles,
      leds,
      mist: at('Mist_Origin', new THREE.Vector3(-1.05, 0.99, -0.55)),
      neon: box('Neon').getCenter(new THREE.Vector3()),
      glow,
    }
  }, [scene, osTex])
}
