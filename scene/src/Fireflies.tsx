// Other visitors in the room right now (presence.ts), as fireflies. Each one drifts near what that person is looking
// at (the projects books, the computer, the pegboard…), flies over when they move on, and fades out when they
// leave. New ones come in through the window. Hover one to see where they're from and what they're doing; click to
// go and look at the same thing.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useOnScreen } from './onScreen'
import { easing } from 'maath'
import * as THREE from 'three'
import { DOING, DOING_HI, someone, usePresence, type Visitor } from './presence'
import { useScene } from './store'
import { useRoom } from './roomModel'
import { INTERACTABLES } from './interactables'
import { useLang } from './i18n'
import { lite } from './device'
import { reached, useBuild } from './build'

const coarse = window.matchMedia('(pointer: coarse)').matches
const WINDOW = new THREE.Vector3(-1.38, 1.62, -0.1) // just inside the window on the left wall (Lights.tsx: WIN)
const GLOW = new THREE.Color('#e9ff9e')
const HALO = new THREE.Color('#b9e23c') // drawn normally, so the firefly still shows against a sunlit wall
// what clicking a firefly opens: the same thing they're looking at
const JOIN: Record<string, string> = { screen: 'monitor', books: 'books', quote: 'quote', notebooks: 'notebooks', guestbook: 'guestbook', stats: 'stats' }

/** a small seeded random per visitor, so their firefly keeps its spot and rhythm */
function rng(key: string) {
  let h = 2166136261
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1)
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61)
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296
  }
}

/** a soft round glow for the sprites */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.18, 'rgba(255,255,255,0.75)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.18)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

interface Shown extends Visitor {
  gone: boolean
}

/** the visitors to draw: everyone here now, plus those who just left (until their firefly has faded) */
function merge(list: Shown[], others: Visitor[]): Shown[] {
  const now = new Map(others.map((v) => [v.id, v]))
  const out = list.map((s) => (now.has(s.id) ? { ...now.get(s.id)!, gone: false } : { ...s, gone: true }))
  for (const v of others) if (!list.some((s) => s.id === v.id)) out.push({ ...v, gone: false })
  return out
}

interface FlyProps {
  v: Shown
  homes: Record<string, THREE.Vector3>
  map: THREE.Texture
  hovered: boolean
  onHover: (id: string | null) => void
  onGone: (id: string) => void
}

function Firefly({ v, homes, map, hovered, onHover, onGone }: FlyProps) {
  const inRoom = useScene((s) => s.view === 'room')
  const lightsOn = useScene((s) => s.lightsOn)
  const lang = useLang((s) => s.lang)
  const group = useRef<THREE.Group>(null)
  const sprite = useRef<THREE.SpriteMaterial>(null)
  const halo = useRef<THREE.SpriteMaterial>(null)
  const core = useRef<THREE.MeshBasicMaterial>(null)
  const fade = useRef(0)
  const r = useMemo(() => rng(v.id), [v.id])
  // where this visitor's firefly hangs about each place (spread out, so a crowd at the books doesn't overlap), its
  // drift and its blinking rhythm
  const seed = useMemo(
    () => ({
      // beside the object's hint dot rather than on it
      spread: new THREE.Vector3((r() < 0.5 ? -1 : 1) * (0.13 + r() * 0.12), 0.03 + r() * 0.12, 0.06 + r() * 0.08),
      air: new THREE.Vector3(-0.9 + r() * 1.8, 1.1 + r() * 0.75, -0.3 + r() * 0.9),
      phase: Array.from({ length: 4 }, () => r() * Math.PI * 2),
      blink: 2.6 + r() * 2.2,
      offset: r(),
    }),
    [r],
  )
  const home = useMemo(() => {
    if (v.at === 'room' || !homes[v.at]) return seed.air
    return homes[v.at].clone().add(seed.spread)
  }, [v.at, homes, seed])

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g || !sprite.current || !halo.current || !core.current) return
    const t = clock.elapsedTime
    const [a, b, c, d] = seed.phase
    const near = v.at === 'room' ? 1 : 0.45 // roam the room more freely than around one object
    const target = home
      .clone()
      .add(
        new THREE.Vector3(
          (Math.sin(t * 0.53 + a) * 0.06 + Math.sin(t * 1.31 + b) * 0.02) * near,
          (Math.sin(t * 0.71 + c) * 0.04 + Math.sin(t * 1.9 + a) * 0.01) * near,
          Math.sin(t * 0.47 + d) * 0.05 * near,
        ),
      )
    easing.damp3(g.position, target, 1.4, dt)
    // fade in on arrival, out when they leave; then let the list forget them
    easing.damp(fade, 'current', v.gone ? 0 : 1, v.gone ? 0.5 : 0.8, dt)
    if (v.gone && fade.current < 0.01) return onGone(v.id)
    // a firefly's blink: a quick bright pulse every few seconds over a steady low glow
    const f = (t / seed.blink + seed.offset) % 1
    const pulse = Math.exp(-(((f - 0.1) / 0.06) ** 2))
    const dark = lightsOn ? 0 : 1
    const glow = (0.4 + 0.6 * pulse + (hovered ? 0.4 : 0)) * fade.current
    sprite.current.opacity = Math.min(1, glow * (0.7 + 0.3 * dark))
    halo.current.opacity = Math.min(1, glow * 0.75 * (1 - 0.6 * dark))
    core.current.opacity = Math.min(1, (0.8 + 0.2 * pulse) * fade.current)
    const s = (0.065 + 0.03 * dark + 0.02 * pulse) * (hovered ? 1.3 : 1)
    g.children[0].scale.setScalar(s)
    g.children[1].scale.setScalar(s * 0.7)
  })

  const tip = useOnScreen()

  const enter = (e: ThreeEvent<PointerEvent>) => {
    if (!inRoom) return
    e.stopPropagation() // the object behind shouldn't light up too
    onHover(v.id)
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!inRoom) return
    e.stopPropagation()
    if (coarse && !hovered) return onHover(v.id) // the first tap reads the label
    onHover(null)
    const key = JOIN[v.at]
    if (key) INTERACTABLES[key].action()
  }

  return (
    <group ref={group} position={WINDOW}>
      <sprite>
        <spriteMaterial ref={sprite} map={map} color={GLOW} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite>
        <spriteMaterial ref={halo} map={map} color={HALO} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </sprite>
      <mesh>
        <sphereGeometry args={[0.0065, 10, 8]} />
        <meshBasicMaterial ref={core} color="#f2ff9a" transparent opacity={0} toneMapped={false} />
      </mesh>
      {/* an easier target than the tiny dot itself */}
      <mesh onPointerMove={lite ? undefined : enter} onPointerOut={lite ? undefined : () => onHover(null)} onClick={click}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {hovered && inRoom && !v.gone && (
        <Html center zIndexRange={[11, 11]} style={{ pointerEvents: 'none' }}>
          <div className="leaf-tip fly-tip" ref={tip}>
            <b>{someone(v.c, lang)}</b>
            <span>
              {lang === 'hi' ? `अभी ${DOING_HI[v.at] ?? DOING_HI.room}` : `is ${DOING[v.at] ?? DOING.room} right now${JOIN[v.at] ? '' : '.'}`}
            </span>
            {JOIN[v.at] && (
              <small>
                {lang === 'hi'
                  ? coarse
                    ? 'साथ देखने के लिए फिर से टैप करें'
                    : 'साथ देखने के लिए क्लिक करें'
                  : coarse
                    ? 'Tap again to join them'
                    : 'Click to join them'}
              </small>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

export function Fireflies() {
  const others = usePresence((s) => s.others)
  const inRoom = useScene((s) => s.view === 'room')
  const { screen, anchors } = useRoom()
  const map = useMemo(() => glowTexture(), [])
  // each place's spot: in front of the object's hint marker, a little toward the viewer
  const homes = useMemo<Record<string, THREE.Vector3>>(
    () => ({
      screen: screen.center.clone().add(new THREE.Vector3(0, 0.06, 0.08)),
      ...Object.fromEntries(Object.entries(anchors).map(([k, p]) => [k, p.clone().add(new THREE.Vector3(0, 0.02, 0.05))])),
    }),
    [screen, anchors],
  )

  // (the room may finish loading after the first check-in, so start from whoever is already known)
  const [list, setList] = useState<Shown[]>(() => merge([], others))
  const [seen, setSeen] = useState(others)
  if (seen !== others) {
    setSeen(others)
    setList(merge(list, others))
  }
  const [pointed, setHovered] = useState<string | null>(null)
  const hovered = inRoom ? pointed : null // leaving the room (a book, the computer) drops the hover
  const here = useBuild((s) => reached(s, 'fireflies')) // the replay (build.ts) brings them with their commit

  useLayoutEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : useScene.getState().hover ? 'pointer' : ''
  }, [hovered])

  return (
    <group name="Fireflies" visible={here}>
      {list.map((v) => (
        <Firefly
          key={v.id}
          v={v}
          homes={homes}
          map={map}
          hovered={hovered === v.id}
          onHover={(id) => setHovered((h) => (id === null && h !== v.id ? h : id))}
          onGone={(id) => setList((l) => l.filter((s) => s.id !== id || !s.gone))}
        />
      ))}
    </group>
  )
}
