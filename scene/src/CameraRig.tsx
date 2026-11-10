import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { BOOKS, useScene } from './store'
import { useRoom, type ScreenRect } from './roomModel'
import { FOCUS } from './focus'
import { STOPS } from './tour'
import { BEATS, clock, useBuild, type Look } from './build'
import { pan, useSwipeHint } from './pan'
import { lite } from './device'

// Standing behind the chair, a little to the right, looking at the desk (like the reference photo)
const ROOM_WIDE = { pos: new THREE.Vector3(0.55, 1.5, 1.75), look: new THREE.Vector3(-0.2, 1.22, -0.7), fov: 50 }
// portrait: centred on the desk (the window and the pegboard are a swipe away), the top shelf clear of the clock card
const ROOM_TALL = { pos: new THREE.Vector3(0.55, 1.72, 1.75), look: new THREE.Vector3(-0.12, 1.18, -0.7), fov: 74 }
const SCREEN_FOV = 35
// Portrait screens can't fit the whole nook, so there the visitor swipes sideways to look around: from the window
// (pan -1) to the pegboard (pan +1). This much the camera's aim and position move at full pan.
const PAN_LOOK = 1.05
const PAN_POS = 0.4
/** a swipe just ended: the click that follows it mustn't open whatever is under the finger */
let swiped = 0


// Moves between views are timed, eased glides (slow in, slow out) rather than springs.
const DUR = { screen: 1.3, focus: 0.75, room: 0.8 }
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

interface Shot {
  pos: THREE.Vector3
  look: THREE.Vector3
  fov: number
}

function screenShot(s: ScreenRect, aspect: number): Shot {
  const t = Math.tan(THREE.MathUtils.degToRad(SCREEN_FOV / 2))
  const byH = s.height / 2 / t / 0.92
  const byW = s.width / 2 / (t * aspect) / 0.96
  const d = Math.max(byH, byW)
  return { pos: s.center.clone().add(new THREE.Vector3(0, 0, d)), look: s.center.clone(), fov: SCREEN_FOV }
}

function focusShot(anchor: THREE.Vector3, key: string, room: Shot, aspect: number): Shot {
  const f = FOCUS[key] ?? { dist: 1.2, side: 1 }
  if (f.target) anchor = new THREE.Vector3(...f.target)
  const toward = room.pos.clone().sub(anchor).normalize()
  const pos = anchor.clone().add(toward.multiplyScalar(f.dist))
  const right = new THREE.Vector3().crossVectors(anchor.clone().sub(pos).normalize(), new THREE.Vector3(0, 1, 0)).normalize()
  // aim past the object toward the panel's side so the object sits off-centre, leaving room for the panel
  const look = anchor.clone().add(right.multiplyScalar(f.side * f.dist * (aspect < 1 ? 0.05 : 0.3)))
  return { pos, look, fov: 45 }
}

/** a stop on the recruiter tour (tour.ts): straight on, with the object a little above the middle of the page,
 * clear of the tour card at the bottom */
function tourShot(anchor: THREE.Vector3, dist: number, lift: number, room: Shot, aspect: number): Shot {
  const d = dist * (aspect < 1 ? 1.6 : 1)
  const pos = anchor.clone().add(room.pos.clone().sub(anchor).normalize().multiplyScalar(d))
  return { pos, look: anchor.clone().add(new THREE.Vector3(0, -d * lift, 0)), fov: 45 }
}

// the "how it was built" replay (build.ts): further back and higher than the room view, to watch the whole nook go
// up, slowly circling; portrait screens stand back far enough to see it end to end
const BUILD_WIDE = { pos: new THREE.Vector3(0.8, 1.78, 2.75), look: new THREE.Vector3(-0.25, 1.08, -0.6), fov: 54 }
const BUILD_TALL = { pos: new THREE.Vector3(0.25, 1.85, 3.0), look: new THREE.Vector3(-0.25, 1.25, -0.7), fov: 76 }
/** what each beat looks at, from how far, and (if not from where the camera stands) from which side */
const BUILD_AT: Partial<Record<Look, { at: THREE.Vector3 | string; dist: number; from?: THREE.Vector3 }>> = {
  screen: { at: 'screen', dist: 1.5 },
  computer: { at: 'screen', dist: 0.8 },
  note: { at: 'screen', dist: 1.15 },
  books: { at: 'books', dist: 1.35 },
  stats: { at: new THREE.Vector3(...FOCUS.stats.target!), dist: 1.35 },
  guestbook: { at: 'guestbook', dist: 1.35 },
  // the window is in the side wall: look at it from across the room, not along the wall
  window: { at: new THREE.Vector3(-1.5, 1.55, -0.1), dist: 2.1, from: new THREE.Vector3(0.35, 1.6, 1.35) },
  shelf: { at: new THREE.Vector3(-0.05, 2.03, -0.55), dist: 1.55 },
}

/** (the replay's card covers the bottom of the page: aim a little low so what's arriving sits above it, more so on
 * a short screen, where the card takes a bigger share) */
function buildShot(look: Look, s: ScreenRect, anchors: Record<string, THREE.Vector3>, aspect: number, short: boolean): Shot {
  const tall = aspect < 1
  const lift = short ? 0.2 : 0.08
  const base = tall ? BUILD_TALL : BUILD_WIDE
  const spot = BUILD_AT[look]
  const at = spot && (spot.at instanceof THREE.Vector3 ? spot.at : spot.at === 'screen' ? s.center : anchors[spot.at])
  if (!spot || !at) {
    const t = clock.ms / 1000
    return {
      pos: base.pos.clone().add(new THREE.Vector3(Math.sin(t * 0.3) * (tall ? 0.2 : 0.35), Math.sin(t * 0.21) * 0.05, 0)),
      look: base.look.clone().add(new THREE.Vector3(0, short ? -0.3 : 0, 0)),
      fov: base.fov,
    }
  }
  const d = spot.dist * (tall ? 1.6 : 1)
  const from = spot.from ?? base.pos
  const pos = at.clone().add(from.clone().sub(at).normalize().multiplyScalar(d))
  return { pos, look: at.clone().add(new THREE.Vector3(0, -d * lift, 0)), fov: tall ? 60 : 46 }
}

export function CameraRig() {
  const { screen, anchors } = useRoom()
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const ready = useScene((s) => s.shown)
  const look = useRef(ROOM_WIDE.look.clone())
  const last = useRef({ view: useScene.getState().view, focus: useScene.getState().focus })
  const glide = useRef<{ from: Shot; t: number; dur: number; delay: number } | null>(null)

  // Esc in the room page (not inside the OS) goes back
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { focus, setView } = useScene.getState()
      if (e.key === 'Escape' && !BOOKS.includes(focus ?? '')) setView('room') // an open book closes itself first
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // portrait: drag sideways across the room to look around
  useLayoutEffect(() => {
    const el = gl.domElement
    let start: { x: number; y: number; v: number } | null = null
    let moved = false
    let speed = 0 // pan units per ms, for a flick
    let lastX = 0
    let lastT = 0
    const tall = () => el.clientWidth < el.clientHeight
    const down = (e: PointerEvent) => {
      if (!tall() || useScene.getState().view !== 'room') return
      start = { x: e.clientX, y: e.clientY, v: pan.v }
      moved = false
      speed = 0
      lastX = e.clientX
      lastT = e.timeStamp
    }
    const move = (e: PointerEvent) => {
      if (!start) return
      const dx = e.clientX - start.x
      if (!moved && Math.abs(dx) < 10) return
      moved = true
      pan.touched = true
      pan.dragging = true
      pan.to = THREE.MathUtils.clamp(start.v - (dx / el.clientWidth) * 1.6, -1, 1)
      const dt = e.timeStamp - lastT
      if (dt > 0) speed = (-(e.clientX - lastX) / el.clientWidth) * 1.6 / dt
      lastX = e.clientX
      lastT = e.timeStamp
    }
    const up = () => {
      if (moved) {
        swiped = performance.now()
        // a flick carries on a little way
        pan.to = THREE.MathUtils.clamp(pan.to + speed * 140, -1, 1)
      }
      pan.dragging = false
      start = null
    }
    // a swipe ends with a click on whatever is under the finger: swallow it before the room sees it
    const click = (e: MouseEvent) => {
      if (performance.now() - swiped < 350) {
        e.stopPropagation()
        e.preventDefault()
      }
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('click', click, true)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('click', click, true)
    }
  }, [gl])

  // the first time a portrait visitor sees the room, the camera glances over to the pegboard and back, so they
  // know there's more to the right
  useLayoutEffect(() => {
    if (!ready || innerWidth >= innerHeight) return // (the canvas may not have its real size yet on the first frame)
    const timers = [
      setTimeout(() => {
        if (pan.touched) return
        pan.to = 0.85
        useSwipeHint.setState({ show: true })
      }, 2600),
      setTimeout(() => !pan.touched && (pan.to = 0), 5200),
      setTimeout(() => useSwipeHint.setState({ show: false }), 7100),
    ]
    return () => timers.forEach(clearTimeout)
  }, [ready])

  useFrame((state, rawDt) => {
    // a hitch (a tab switch, the OS loading) must not make a glide skip ahead, so cap the step; but only at 0.1 s,
    // so a phone drawing 10–20 frames a second still glides in real time instead of in slow motion
    const dt = Math.min(rawDt, 0.1)
    const camera = state.camera as THREE.PerspectiveCamera
    const { view, focus, arrived, setArrived, hover, setScreenRect, setFocusPoint, tour } = useScene.getState()
    const aspect = size.width / size.height
    // the room sits right under the finger while it drags, then settles quickly
    if (pan.dragging && aspect < 1) pan.v = pan.to
    else easing.damp(pan, 'v', aspect < 1 ? pan.to : 0, 0.3, dt)
    const room =
      aspect < 1
        ? {
            pos: ROOM_TALL.pos.clone().add(new THREE.Vector3(pan.v * PAN_POS, 0, 0)),
            look: ROOM_TALL.look.clone().add(new THREE.Vector3(pan.v * PAN_LOOK, 0, 0)),
            fov: ROOM_TALL.fov,
          }
        : ROOM_WIDE
    const stop = tour !== null ? STOPS[tour] : null
    const replay = useBuild.getState().at
    const building = view === 'room' && replay !== null
    const beatLook = replay !== null && replay >= 0 && replay < BEATS.length ? (BEATS[replay].look ?? 'wide') : 'wide'
    const target = focus === 'monitor' ? screen.center : focus && FOCUS[focus]?.target ? new THREE.Vector3(...FOCUS[focus].target!) : focus && anchors[focus]
    const shot = building
      ? buildShot(beatLook, screen, anchors, aspect, size.height < 500)
      : view === 'screen'
        ? screenShot(screen, aspect)
        : view === 'focus' && focus && stop?.dist && target
          ? tourShot(target, stop.dist, stop.lift ?? 0.17, room, aspect)
          : view === 'focus' && focus && anchors[focus]
            ? focusShot(anchors[focus], focus, room, aspect)
            : room

    // start a glide whenever the view (or the focused object) changes
    if (view !== last.current.view || focus !== last.current.focus) {
      const leavingScreen = last.current.view === 'screen'
      last.current = { view, focus }
      glide.current = {
        from: { pos: camera.position.clone(), look: look.current.clone(), fov: camera.fov },
        t: 0,
        dur: DUR[view],
        // coming out of the monitor: let the OS shrink back into the screen first
        delay: leavingScreen ? 0.3 : 0,
      }
    }

    const done = () => {
      if (arrived || view === 'room') return
      if (view === 'screen') {
        // where the screen landed on the page: the OS grows out of exactly this rectangle
        const c = screen.center
        const tl = new THREE.Vector3(c.x - screen.width / 2, c.y + screen.height / 2, c.z).project(camera)
        const br = new THREE.Vector3(c.x + screen.width / 2, c.y - screen.height / 2, c.z).project(camera)
        const x = ((tl.x + 1) / 2) * size.width
        const y = ((1 - tl.y) / 2) * size.height
        setScreenRect({ x, y, w: ((br.x + 1) / 2) * size.width - x, h: ((1 - br.y) / 2) * size.height - y })
      }
      if (view === 'focus' && focus && anchors[focus]) {
        const p = anchors[focus].clone().project(camera)
        setFocusPoint({ x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height })
      }
      setArrived(true)
    }

    if (glide.current) {
      const g = glide.current
      if (g.delay > 0) {
        g.delay -= dt
        return
      }
      g.t = Math.min(1, g.t + dt / g.dur)
      const k = easeInOut(g.t)
      camera.position.lerpVectors(g.from.pos, shot.pos, k)
      look.current.lerpVectors(g.from.look, shot.look, k)
      camera.fov = THREE.MathUtils.lerp(g.from.fov, shot.fov, k)
      camera.lookAt(look.current)
      camera.updateProjectionMatrix()
      if (g.t >= 1) {
        glide.current = null
        done()
      }
      return
    }

    const pos = shot.pos.clone()
    const tgt = shot.look.clone()
    if (view === 'room' && !building) {
      // parallax: the camera follows the pointer a little, so near things slide past far things
      const t = state.clock.elapsedTime
      // (touch screens: the "pointer" is wherever the finger last was, so there only the sway plays)
      const px = lite ? 0 : state.pointer.x
      const py = lite ? 0 : state.pointer.y
      pos.x += px * 0.2 + Math.sin(t * 0.25) * 0.015
      pos.y += py * 0.1 + Math.sin(t * 0.33) * 0.008
      tgt.x += px * 0.06
      tgt.y += py * 0.03
      // hovering something clickable: lean in toward it a little, so the room shifts in depth around it
      const a = hover ? anchors[hover] : undefined
      if (a) {
        pos.lerp(a, 0.045)
        tgt.lerp(a, 0.12)
      }
    }

    // phones follow a swipe closely; a mouse gets the slower, floatier parallax
    // (the replay's camera moves slower, like a camera on a slider)
    const smooth = building ? 0.4 : view === 'room' ? (pan.dragging ? 0.03 : lite ? 0.1 : 0.3) : 0.2
    easing.damp3(camera.position, pos, smooth, dt)
    easing.damp3(look.current, tgt, smooth, dt)
    easing.damp(camera, 'fov', shot.fov, smooth, dt)
    camera.lookAt(look.current)
    camera.updateProjectionMatrix()
    done()
  })
  return null
}
