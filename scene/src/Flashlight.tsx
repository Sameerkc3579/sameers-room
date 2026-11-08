// With the lights off (the mushroom lamp, or asking the chat), the cursor becomes a torch: a warm spotlight held a
// little below and to the right of the camera that follows the pointer, with a slight hand-held lag. The light is
// always there (at zero while the lights are on) so switching doesn't make three.js recompile every material.
// One note on the wall only shows up when the beam is on it.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { useScene } from './store'
import { useT } from './i18n'

const WALL_Z = -0.7475 // the back wall (blender/build_room.py: WALL_Z -0.75)
const NOTE = new THREE.Vector3(-1.1, 1.08, WALL_Z + 0.002) // bare wall between the window and the diffuser
const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive'
const REACH = 2.6 // how far ahead the torch aims along the pointer ray
const ANGLE = 0.2 // the beam's half-angle (radians)

// Touch screens have no cursor to follow, so there the torch sweeps around the room by itself, like someone
// exploring with it; touching or dragging points it at the finger, and a moment after letting go it drifts back
// into its sweep from wherever it was left.
const touch = window.matchMedia('(pointer: coarse)').matches
const HOLD = 2500 // ms the torch stays where the finger left it
let touchedAt = -Infinity
if (touch) for (const e of ['pointerdown', 'pointermove']) addEventListener(e, () => (touchedAt = performance.now()), { passive: true })

/** pencil on the wall: only the torch shows it */
function noteTexture() {
  const c = document.createElement('canvas')
  c.width = 768
  c.height = 300
  const g = c.getContext('2d')!
  g.fillStyle = '#3a3128'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const line = (text: string, y: number, size: number) => {
    g.font = `600 ${size}px ${HAND}`
    const w = g.measureText(text).width
    if (w > 720) g.font = `600 ${Math.floor((size * 720) / w)}px ${HAND}`
    g.fillText(text, 384, y)
  }
  line('You found the torch note ✦', 62, 46)
  line('most of my best code happened', 140, 38)
  line('after this lamp went off.', 196, 38)
  line('— S', 262, 36)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function Flashlight() {
  const on = useScene((s) => s.lightsOn)
  const light = useRef<THREE.SpotLight>(null)
  const note = useRef<THREE.MeshBasicMaterial>(null)
  const map = useMemo(() => noteTexture(), [])
  const target = useMemo(() => new THREE.Object3D(), [])
  const aim = useMemo(() => new THREE.Vector3(0, 1.2, -0.7), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), []) // where on the screen the torch points
  const sweep = useMemo(() => new THREE.Vector2(), [])

  useFrame(({ camera, pointer, clock }, dt) => {
    const l = light.current
    if (!l) return
    // held a little below and to the right of the eye
    l.position.copy(camera.position).add(new THREE.Vector3(0.12, -0.12, 0).applyQuaternion(camera.quaternion))
    if (touch) {
      const t = clock.elapsedTime
      const wandering = performance.now() - touchedAt > HOLD
      sweep.set(
        Math.sin(t * 0.42) * 0.7 + Math.sin(t * 1.05 + 1) * 0.15,
        Math.sin(t * 0.61 + 0.6) * 0.42 - 0.05 + Math.sin(t * 1.4) * 0.06,
      )
      // a lazy hand while it wanders, a quick one following the finger
      easing.damp2(ndc, wandering ? sweep : pointer, wandering ? 0.9 : 0.06, dt)
    } else ndc.copy(pointer)
    ray.setFromCamera(ndc, camera)
    easing.damp3(aim, ray.ray.at(REACH, new THREE.Vector3()), 0.12, dt)
    target.position.copy(aim)
    target.updateMatrixWorld()
    easing.damp(l, 'intensity', on ? 0 : 16, on ? 0.1 : 0.35, dt)
    // the note shows as much as the beam lights it
    const m = note.current
    if (!m) return
    const toNote = NOTE.clone().sub(l.position).normalize()
    const toAim = aim.clone().sub(l.position).normalize()
    const lit = on ? 0 : 1 - THREE.MathUtils.smoothstep(toNote.angleTo(toAim), ANGLE * 0.35, ANGLE * 0.9)
    easing.damp(m, 'opacity', lit * 0.85, 0.15, dt)
  })

  return (
    <>
      <primitive object={target} />
      <spotLight ref={light} target={target} color="#ffe9c4" intensity={0} distance={6} decay={2} angle={ANGLE} penumbra={0.5} />
      <mesh position={NOTE} rotation={[0, 0, THREE.MathUtils.degToRad(2)]}>
        <planeGeometry args={[0.4, 0.156]} />
        <meshBasicMaterial ref={note} map={map} transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  )
}

/** A one-time nudge when the lights first go off: the cursor is a torch now. */
export function TorchHint() {
  const on = useScene((s) => s.lightsOn)
  const inRoom = useScene((s) => s.view === 'room')
  const [shown, setShown] = useState<'never' | 'now' | 'done'>('never')
  const t = useT()
  if (!on && inRoom && shown === 'never') setShown('now')
  useEffect(() => {
    if (shown !== 'now') return
    const t = setTimeout(() => setShown('done'), 4500)
    return () => clearTimeout(t)
  }, [shown])
  if (shown !== 'now' || on) return null
  return (
    <p className="torch-hint">
      {touch
        ? t('Lights off. The torch is looking around: touch and drag to point it.', 'लाइट बंद। टॉर्च खुद घूम रही है: उसे घुमाने के लिए छूकर खींचें।')
        : t('Lights off. Your cursor is a torch now, look around.', 'लाइट बंद। अब आपका कर्सर एक टॉर्च है, चारों ओर देखिए।')}
    </p>
  )
}
