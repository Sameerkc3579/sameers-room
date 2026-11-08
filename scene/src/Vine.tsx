// The guestbook vine: a pothos trailing from the pot on the top shelf along the shelf's front edge, with one leaf
// for every note in the guestbook (Guestbook.tsx), oldest by the pot and the newest at the growing tip. Hover a
// leaf to see whose it is; click it to open the guestbook. New notes grow their leaf when you're back in the room.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useOnScreen } from './onScreen'
import * as THREE from 'three'
import { isMine, useNotes, type Note } from './live'
import { useScene } from './store'
import { INTERACTABLES } from './interactables'
import { lite } from './device'
import { cheap } from './lite'

const coarse = window.matchMedia('(pointer: coarse)').matches

// top shelf: underside y 2.02, top 2.05, front edge z -0.53 (blender/build_room.py: S1, WALL_Z + 0.22); its pot
// (Shelf_Plant) stands at x -0.82
const FRONT = -0.515
const LIP = 2.032
const HOOKS = [-0.7, -0.4, -0.08, 0.24, 0.55, 0.84] // where the vine is tucked under the shelf edge

/** from the pot, over the front edge, then draped hook to hook along the shelf, with a short tail at the end */
function makePath() {
  const pts = [new THREE.Vector3(-0.8, 2.13, -0.62), new THREE.Vector3(-0.765, 2.115, -0.565), new THREE.Vector3(-0.725, 2.07, -0.522)]
  HOOKS.slice(1).forEach((b, h) => {
    const a = HOOKS[h]
    const sag = h % 2 ? 0.045 : 0.07
    for (let k = h ? 1 : 0; k <= 8; k++) {
      const f = k / 8
      pts.push(new THREE.Vector3(a + (b - a) * f, LIP - sag * Math.sin(Math.PI * f), FRONT + 0.014 * Math.sin(Math.PI * f)))
    }
  })
  pts.push(new THREE.Vector3(0.858, 1.985, FRONT + 0.008), new THREE.Vector3(0.866, 1.9, FRONT + 0.014), new THREE.Vector3(0.872, 1.83, FRONT + 0.02))
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
}

/** the same pothos heart leaf as blender/roomkit.py's heart_leaf (1 unit wide-ish): stalk end at the origin, tip
 * hanging down -y, cupped toward the viewer */
function leafGeometry() {
  const N = 24
  const notch = 5 / 17
  const pos = [0, -0.05 - notch, 0.12]
  for (let i = 0; i < N; i++) {
    const t = (2 * Math.PI * i) / N
    const x = (16 * Math.sin(t) ** 3) / 17
    const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17
    pos.push(x, y - notch, -Math.abs(x) * 0.25)
  }
  const index: number[] = []
  for (let i = 1; i <= N; i++) index.push(0, (i % N) + 1, i)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

const GREENS = ['#3f6a33', '#5a8a40', '#78a552'].map((c) => new THREE.Color(c))
const HOVER = new THREE.Color('#a9d27c')
const OWN = new THREE.Color('#c6e07a') // the visitor's own leaves, a little sunnier so they can find them again
const GREET_AFTER = 8000 // on arrival, the newest note says hi once the hint labels have folded away (Hints.tsx)
const GREET_FOR = 6000
let greeted = false // once per visit, not every time they come back from a book
const MAX = 2 + 100 // two starter leaves + the notes /api/notes returns (80)
const START = 0.07 // the first leaf, just past the pot's rim
const GAP = 0.034 // between leaves, until the vine runs out of shelf and they bunch up
const SEEDS = 2 // leaves that are always there, so the vine exists before the first note
const GROW = 1.4 // seconds for a new leaf to unfurl

/** a small seeded random per leaf, so a leaf keeps its look when others are added */
function rng(key: string) {
  let h = 2166136261
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1)
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61)
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296
  }
}

interface Leaf {
  key: string
  note: Note | null
  s: number
  pos: THREE.Vector3
  quat: THREE.Quaternion
  size: number
  color: THREE.Color
}

function layout(notes: Note[], curve: THREE.CatmullRomCurve3, length: number): Leaf[] {
  const all: (Note | null)[] = [...Array(SEEDS).fill(null), ...[...notes].reverse()].slice(0, MAX)
  const gap = Math.min(GAP, (length - START - 0.02) / Math.max(1, all.length - 1))
  return all.map((note, i) => {
    const key = note?.id ?? `seed-${i}`
    const r = rng(key)
    const s = START + i * gap
    const u = s / length
    const side = i % 2 ? 1 : -1
    const along = curve.getTangentAt(u)
    // attach a little to one side of the stem, alternating, and splay the leaf that way
    const pos = curve.getPointAt(u).add(new THREE.Vector3(-along.y, along.x, 0).multiplyScalar(side * 0.004)).add(new THREE.Vector3(0, 0, 0.004))
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(-20 + r() * 50),
      THREE.MathUtils.degToRad(side * (10 + r() * 30)),
      THREE.MathUtils.degToRad(side * (15 + r() * 40)),
    )
    return {
      key,
      note,
      s,
      pos,
      quat: new THREE.Quaternion().setFromEuler(euler),
      size: 0.032 * (note ? 0.8 + r() * 0.4 : 0.65),
      color: note && isMine(note.id) ? OWN : GREENS[Math.floor(r() * GREENS.length)],
    }
  })
}

const month = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const ease = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2 // ease-out with a little overshoot

export function Vine() {
  const notes = useNotes((s) => s.notes)
  const status = useNotes((s) => s.status)
  const inRoom = useScene((s) => s.view === 'room')
  const touring = useScene((s) => s.tour !== null)
  const curve = useMemo(() => makePath(), [])
  const length = useMemo(() => curve.getLength(), [curve])
  const leaves = useMemo(() => layout(notes, curve, length), [notes, curve, length])
  const geometry = useMemo(() => leafGeometry(), [])
  const material = useMemo(() => cheap(new THREE.MeshStandardMaterial({ roughness: 0.45, side: THREE.DoubleSide, name: 'Leaf' })), [])
  const stemMaterial = useMemo(() => cheap(new THREE.MeshStandardMaterial({ color: '#5d7a3c', roughness: 0.6, name: 'Stem' })), [])
  const mesh = useRef<THREE.InstancedMesh>(null)
  const stem = useRef<THREE.Mesh>(null)
  const [pointed, setHovered] = useState<number | null>(null)
  const hovered = inRoom ? pointed : null // leaving the room (a book, the computer) drops the hover
  // a leaf whose label shows without hovering: the visitor's own new leaf (until they click or press something,
  // so they see where their note went), or on arrival the newest note for a few seconds
  const [featured, setFeatured] = useState<{ key: string; sticky: boolean } | null>(null)
  useLayoutEffect(() => {
    if (!featured) return
    const done = () => setFeatured(null)
    if (!featured.sticky) {
      const t = setTimeout(done, GREET_FOR)
      return () => clearTimeout(t)
    }
    const max = setTimeout(done, 45_000)
    // the click that opened the guestbook's Close button is long gone, but give it a moment anyway
    const arm = setTimeout(() => {
      for (const e of ['pointerdown', 'keydown', 'wheel']) addEventListener(e, done, { once: true })
    }, 1500)
    return () => {
      clearTimeout(max)
      clearTimeout(arm)
      for (const e of ['pointerdown', 'keydown', 'wheel']) removeEventListener(e, done)
    }
  }, [featured])
  useLayoutEffect(() => {
    if (greeted || status !== 'ready' || !notes.length) return
    const t = setTimeout(() => {
      greeted = true
      const newest = leaves.find((l) => l.note?.id === notes[0].id)
      if (newest) setFeatured((f) => f ?? { key: newest.key, sticky: false })
    }, GREET_AFTER)
    return () => clearTimeout(t)
  }, [status, notes, leaves])

  // when each leaf started growing: -Infinity = already grown when the page loaded, null = waiting until the
  // visitor is back in the room (a note written in the guestbook book grows once the book closes)
  const born = useRef(new Map<string, number | null>())
  const settled = useRef(false)
  const shown = useRef({ grown: new Float32Array(MAX).fill(-1), leaves: [] as Leaf[], tip: -1 })
  useLayoutEffect(() => {
    for (const l of leaves) if (!born.current.has(l.key)) born.current.set(l.key, settled.current ? null : -Infinity)
    if (status === 'ready') settled.current = true
  }, [leaves, status])

  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const t = clock.elapsedTime
    const room = useScene.getState().view === 'room'
    const last = shown.current
    const relaid = last.leaves !== leaves
    let waiting = 0
    let changed = relaid
    let tip = 0
    const tmp = new THREE.Matrix4()
    leaves.forEach((l, i) => {
      let b = born.current.get(l.key)
      if (b === undefined) b = -Infinity // first frame, before the effect above has run
      if (b === null && room) {
        born.current.set(l.key, (b = t + 0.9 + waiting++ * 0.45)) // after the camera glide
        if (l.note && isMine(l.note.id)) setFeatured({ key: l.key, sticky: true })
      }
      const g = b === null ? 0 : THREE.MathUtils.clamp((t - b) / GROW, 0, 1)
      if (g > 0 || b === -Infinity) tip = Math.max(tip, l.s - (1 - Math.min(1, g * 2)) * GAP)
      if (!relaid && last.grown[i] === g) return
      last.grown[i] = g
      changed = true
      const k = Math.max(1e-4, l.size * (g >= 1 ? 1 : ease(g)))
      m.setMatrixAt(i, tmp.compose(l.pos, l.quat, new THREE.Vector3(k, k, k)))
      m.setColorAt(i, i === hovered ? HOVER : l.color)
    })
    if (changed) {
      m.count = leaves.length
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      m.computeBoundingSphere()
      last.leaves = leaves
    }
    // the stem reaches just past the newest leaf, and follows a growing one out
    tip = Math.min(length, tip + 0.018)
    if (Math.abs(tip - last.tip) > 5e-4 && stem.current) {
      last.tip = tip
      const n = Math.max(2, Math.ceil(tip / 0.012))
      const pts = Array.from({ length: n + 1 }, (_, j) => curve.getPointAt((tip * j) / n / length))
      stem.current.geometry.dispose()
      stem.current.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.0022, 5)
    }
  })

  // colour the hovered leaf even when no leaf is growing
  useLayoutEffect(() => {
    shown.current.grown.fill(-1)
  }, [hovered])
  useLayoutEffect(() => {
    document.body.style.cursor = hovered !== null ? 'pointer' : useScene.getState().hover ? 'pointer' : ''
  }, [hovered])

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!inRoom || e.instanceId === undefined) return
    e.stopPropagation() // the room behind shouldn't light up too
    if (e.instanceId !== hovered) setHovered(e.instanceId)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!inRoom || e.instanceId === undefined) return
    e.stopPropagation()
    if (coarse && hovered !== e.instanceId) return setHovered(e.instanceId) // first tap reads the leaf
    setHovered(null)
    useScene.getState().markUsed('guestbook')
    INTERACTABLES.guestbook.action()
  }

  const tip = useOnScreen()
  const leaf = hovered !== null ? leaves[hovered] : inRoom && !touring ? leaves.find((l) => l.key === featured?.key) : null
  return (
    <group>
      <mesh ref={stem} material={stemMaterial} castShadow receiveShadow />
      <instancedMesh
        ref={mesh}
        args={[geometry, material, MAX]}
        castShadow
        receiveShadow
        onPointerMove={lite ? undefined : onMove}
        onPointerOut={lite ? undefined : () => setHovered(null)}
        onClick={onClick}
      />
      {leaf && inRoom && (
        <Html position={leaf.pos} center zIndexRange={[11, 11]} style={{ pointerEvents: 'none' }}>
          <div className="leaf-tip" ref={tip}>
            {leaf.note ? (
              <>
                <span>
                  <b>{isMine(leaf.note.id) ? 'Your leaf' : `${leaf.note.name}’s leaf`}</b> · {month(leaf.note.at)}
                </span>
                <q>{clip(leaf.note.text, 70)}</q>
              </>
            ) : (
              <>
                <b>A leaf for every guestbook note</b>
                <q className="plain">Leave one and this vine grows.</q>
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}
