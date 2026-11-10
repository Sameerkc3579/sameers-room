// The 3D half of the "how it was built" replay (build.ts): every object of the room sits out until its commit's
// beat, then arrives: the floor spreads out, the walls rise through it, furniture drops into place and the small
// things pop up. Before that the room comes apart in reverse. Everything is a function of the replay's clock, so
// pausing, skipping and going back all just work, and when the replay ends every object is put back exactly.
import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BEATS, PIECE_AT, START, TEARDOWN, TOTAL, END, clock, useBuild, type Piece } from './build'
import { useRoom } from './roomModel'
import { keyOf } from './interactables'
import { lite } from './device'
import { land } from './sound'

type Arrive = 'grow' | 'rise' | 'drop' | 'pop'

/** which beat brings each object of room.glb (and pinned.ts's papers), and how it arrives */
const RULES: [RegExp, Piece, Arrive][] = [
  [/^Floor$/, 'shell', 'grow'],
  [/^(Wall_|Skirting_)/, 'shell', 'rise'],
  [/^Ceiling$/, 'shell', 'drop'],
  [/^(Win_|Glass_Window$|Sill$|Blinds$)/, 'window', 'drop'],
  [/^(Desk_Top|Desk_Legs|Drawers|Chair|Shelf_Upper|Shelf_Lower|Pegboard|Riser|Desk_Mat|LED_Upper|LED_Lower)$/, 'furniture', 'drop'],
  [
    /^(Monitor|Screen|Keyboard|Mouse|Headphones|Desk_Clock|DeskClock_Screen|Mushroom_Lamp|Lamp_Light|Humidifier|Mist_Origin|Tumbler|Pen|Notebooks|Books|Neon|Mirror|Focus_Card)$/,
    'setup',
    'drop',
  ],
  [/^Stats$/, 'stats', 'pop'],
  [/^Guestbook$/, 'guestbook', 'pop'],
  [/^Hunt_Note$/, 'hunt', 'pop'],
]

/** parts that belong together move together: the walls, a candle's jar, wax and flame, the monitor and its screen… */
function together(name: string) {
  const candle = /^(?:Candle|Candle_Jar|Candle_Wax|Flame)_(\d+)$/.exec(name)
  if (candle) return `candle${candle[1]}`
  if (/^(Wall_|Skirting_)/.test(name)) return 'walls' // they rise as one, window hole and all
  return (
    { Screen: 'Monitor', DeskClock_Screen: 'Desk_Clock', Lamp_Light: 'Mushroom_Lamp', Mist_Origin: 'Humidifier', Fern_Planter: 'Fern', Tulip_Vase: 'Tulips' } as Record<string, string>
  )[name] ?? name
}

interface Part {
  o: THREE.Object3D
  piece: Piece
  arrive: Arrive
  pos: THREE.Vector3
  scale: THREE.Vector3
  /** ms after its beat starts that it begins to arrive */
  delay: number
  /** ms into the teardown that it begins to leave */
  leave: number
  /** last applied progress, so still objects aren't touched every frame */
  k: number
}

const ARRIVE_MS = 550
const LEAVE_MS = 380
const RISE = 2.9 // the walls come up from this far below the floor
const DROP = 0.45
const easeOut = (x: number) => 1 - (1 - x) ** 3
const easeBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2 // overshoots a little

function collect(scene: THREE.Object3D): Part[] {
  const groups = new Map<string, Part[]>()
  for (const o of scene.children) {
    const [, piece, arrive] = RULES.find(([re]) => re.test(o.name)) ?? [null, 'decor' as Piece, 'pop' as Arrive]
    const part: Part = { o, piece, arrive, pos: o.position.clone(), scale: o.scale.clone(), delay: 0, leave: 0, k: 1 }
    const key = `${piece}:${together(o.name)}`
    groups.set(key, [...(groups.get(key) ?? []), part])
  }
  // within a beat: the big pieces bottom-up, the decor in a sweep from the window to the pegboard
  const byPiece = new Map<Piece, Part[][]>()
  for (const g of groups.values()) byPiece.set(g[0].piece, [...(byPiece.get(g[0].piece) ?? []), g])
  const at = (g: Part[]) => g[0].o.getWorldPosition(new THREE.Vector3())
  const order: Part[][] = []
  for (const [piece, gs] of byPiece) {
    gs.sort((a, b) => (piece === 'decor' ? at(a).x - at(b).x : at(a).y - at(b).y || at(a).x - at(b).x))
    const spread = Math.max(0, BEATS[PIECE_AT[piece]].ms - ARRIVE_MS - 250)
    gs.forEach((g, i) => g.forEach((p) => (p.delay = gs.length > 1 ? (i / (gs.length - 1)) * spread : 150)))
    order.push(...gs)
  }
  // coming apart is the build in reverse: what arrived last leaves first
  order.sort((a, b) => START[PIECE_AT[b[0].piece]] + b[0].delay - (START[PIECE_AT[a[0].piece]] + a[0].delay))
  order.forEach((g, i) => g.forEach((p) => (p.leave = (i / Math.max(1, order.length - 1)) * (TEARDOWN - LEAVE_MS - 100))))
  return order.flat()
}

function place(p: Part, k: number) {
  const { o } = p
  o.visible = k > 0
  o.position.copy(p.pos)
  o.scale.copy(p.scale)
  if (k >= 1 || k <= 0) return
  if (p.arrive === 'grow') {
    const s = Math.max(1e-3, easeOut(k))
    o.scale.set(p.scale.x * s, p.scale.y, p.scale.z * s)
  } else if (p.arrive === 'rise') o.position.y -= (1 - easeOut(k)) * RISE
  else if (p.arrive === 'drop') {
    o.position.y += (1 - easeOut(k)) * DROP * (o.name === 'Ceiling' ? 2.5 : 1)
    o.scale.multiplyScalar(0.85 + 0.15 * easeOut(k))
  } else {
    o.position.y += (1 - easeOut(k)) * 0.08
    o.scale.multiplyScalar(Math.max(1e-3, easeBack(k)))
  }
}

/** how far along each beat's arrivals are at this moment of the replay */
function progress(p: Part, ms: number) {
  if (ms < TEARDOWN) return 1 - THREE.MathUtils.clamp((ms - p.leave) / LEAVE_MS, 0, 1)
  return THREE.MathUtils.clamp((ms - START[PIECE_AT[p.piece]] - p.delay) / ARRIVE_MS, 0, 1)
}

const HIGHLIGHT = new THREE.Color('#ffb070')
const BLACK = new THREE.Color(0)
const PULSE = ['books', 'notebooks', 'quote'] // "open as books": the three books glow for their commit

interface Rig {
  parts: Part[]
  screen: THREE.MeshBasicMaterial
  /** the books' materials, which glow for their commit */
  books: THREE.MeshStandardMaterial[]
  pulsing: boolean
}

function rigFor(scene: THREE.Object3D): Rig {
  const books: THREE.MeshStandardMaterial[] = []
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && PULSE.includes(keyOf(o) ?? ''))
      for (const m of [o.material].flat()) if ('emissive' in m && m.name !== 'LampBulb') books.push(m as THREE.MeshStandardMaterial)
  })
  const screen = (scene.getObjectByName('Screen') as THREE.Mesh).material as THREE.MeshBasicMaterial
  return { parts: collect(scene), screen, books, pulsing: false }
}

/** everything back exactly where it was */
function restore(rig: Rig) {
  for (const p of rig.parts) {
    p.k = 1
    place(p, 1)
  }
  rig.screen.color.setScalar(1)
  for (const m of rig.books) {
    m.emissive.copy(BLACK)
    m.emissiveIntensity = 1
  }
  rig.pulsing = false
}

/** puts every part where it is at this moment of the replay; says whether any moved, and whether any arrived */
function advance(rig: Rig, ms: number) {
  let moved = false
  let landed = false
  for (const p of rig.parts) {
    const k = progress(p, ms)
    if (k === p.k) continue
    if (k >= 1 || k <= 0) landed = true
    if (k >= 1 && ms >= TEARDOWN) land(p.arrive)
    p.k = k
    place(p, k)
    moved = true
  }
  return { moved, landed }
}

/** the monitor stays dark until SameerOS exists; the books glow for the commit that made them open */
function light(rig: Rig, at: number, ms: number) {
  const os = THREE.MathUtils.clamp((ms - START[PIECE_AT.screen] - 200) / 600, 0, 1)
  rig.screen.color.setScalar(0.04 + 0.96 * os)
  const pulse = at === PIECE_AT.books
  if (!pulse && !rig.pulsing) return
  const glow = pulse ? 0.4 * (0.5 - 0.5 * Math.cos(((ms - START[at]) / 900) * Math.PI * 2)) : 0
  for (const m of rig.books) {
    m.emissive.copy(pulse ? HIGHLIGHT : BLACK)
    m.emissiveIntensity = pulse ? glow : 1
  }
  rig.pulsing = pulse
}

export function BuildRig() {
  const { scene } = useRoom()
  const get = useThree((s) => s.get)
  const rig = useRef<Rig | null>(null)
  const active = useBuild((s) => s.at !== null)
  useLayoutEffect(() => {
    rig.current = rigFor(scene)
  }, [scene])

  // the replay is over (or skipped)
  useLayoutEffect(() => {
    if (active || !rig.current) return
    restore(rig.current)
    get().gl.shadowMap.needsUpdate = true
  }, [active, get])

  useFrame(({ gl }, dt) => {
    const b = useBuild.getState()
    const r = rig.current
    if (b.at === null || !r) return
    if (!b.paused && b.at !== END) clock.ms = Math.min(TOTAL, clock.ms + Math.min(dt, 0.1) * 1000)
    const ms = clock.ms
    let at = ms < TEARDOWN ? -1 : END
    if (ms < TOTAL) for (let i = 0; i < BEATS.length; i++) if (ms >= START[i]) at = i
    if (at !== b.at && b.at !== END) useBuild.setState({ at })

    const { moved, landed } = advance(r, ms)
    // the shadows are normally drawn once (Lights.tsx); phones redraw them only as each piece lands
    if (moved && (!lite || landed)) gl.shadowMap.needsUpdate = true

    light(r, at, ms)
  })
  return null
}
