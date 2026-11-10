import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import { ContactShadows, Environment, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { useScene } from './store'
import { useRoom } from './roomModel'
import { useOutside, type Sky } from './raipur'
import { lite } from './device'
import { reached, useBuild } from './build'

RectAreaLightUniformsLib.init()
const WHITE = new THREE.Color('#ffffff')
// how bright the phone stand-ins for the area lights are, matched by eye to the desktop room
const WIN_SPOT = 1.6
const LED_POINT = 2.4

// window on the left wall (blender/build_room.py)
const WIN = { x: -1.5, y: 1.63, z: -0.1, w: 1.04, h: 1.3 }

/** A rect light that shines toward `target` (RectAreaLights face along their -Z once aimed with lookAt). */
function AimedRect({
  target,
  lightRef,
  ...props
}: { target: [number, number, number]; lightRef?: (l: THREE.RectAreaLight | null) => void } & ThreeElements['rectAreaLight']) {
  const ref = useRef<THREE.RectAreaLight>(null)
  const [tx, ty, tz] = target
  useLayoutEffect(() => ref.current?.lookAt(tx, ty, tz), [tx, ty, tz])
  return (
    <rectAreaLight
      ref={(l) => {
        ref.current = l
        lightRef?.(l)
      }}
      {...props}
    />
  )
}

/** a phone's stand-in for one LED strip: a wide warm cone down the wall from under the shelf */
function LedSpot({ x, y, z, intensity }: { x: number; y: number; z: number; intensity: number }) {
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(x, y - 1, z - 0.12)
    return o
  }, [x, y, z])
  return (
    <>
      <primitive object={target} />
      <spotLight target={target} color="#ffb662" intensity={intensity} position={[x, y - 0.02, z + 0.03]} angle={1.25} penumbra={1}
        distance={1.6} decay={2} />
    </>
  )
}

/* ---------- outside light: Raipur's time of day and weather (raipur.ts) ---------- */

interface OutsideLight {
  win: THREE.Color // daylight panel in the window
  winI: number
  sun: THREE.Color // low sun that casts the shadows
  sunI: number
  hemi: number
  env: number
  view: THREE.Color // tint of the garden photo outside
}
const preset = (win: string, winI: number, sun: string, sunI: number, hemi: number, env: number, view: string) => ({
  win: new THREE.Color(win), winI, sun: new THREE.Color(sun), sunI, hemi, env, view: new THREE.Color(view),
})
const DAY = preset('#e6f2dc', 4, '#f1f7e6', 1.1, 0.42, 0.32, '#f4f8ef')
const GOLDEN = preset('#ffc48a', 3.4, '#ff9f55', 1.05, 0.34, 0.24, '#f0a070')
const NIGHT = preset('#7f93bd', 0.55, '#8fa3d0', 0, 0.2, 0.1, '#26324a')
/** how each weather dims the sun / window, greys out and darkens the view */
const WEATHER: Record<Sky, { sun: number; win: number; grey: number; dark: number }> = {
  clear: { sun: 1, win: 1, grey: 0, dark: 1 },
  cloudy: { sun: 0.3, win: 0.8, grey: 0.35, dark: 0.92 },
  fog: { sun: 0.25, win: 0.9, grey: 0.55, dark: 1.02 },
  rain: { sun: 0.08, win: 0.6, grey: 0.45, dark: 0.72 },
  storm: { sun: 0.03, win: 0.45, grey: 0.5, dark: 0.55 },
}

function mixLight(a: OutsideLight, b: OutsideLight, t: number): OutsideLight {
  const n = (x: number, y: number) => x + (y - x) * t
  return {
    win: a.win.clone().lerp(b.win, t), winI: n(a.winI, b.winI), sun: a.sun.clone().lerp(b.sun, t), sunI: n(a.sunI, b.sunI),
    hemi: n(a.hemi, b.hemi), env: n(a.env, b.env), view: a.view.clone().lerp(b.view, t),
  }
}

/** with the lights off the blinds are drawn too, so it's about as dark as night at any hour and the torch
 * (Flashlight.tsx) matters: each outside light is capped well below its NIGHT level */
const DRAWN = { winI: 0.12, sunI: 0, hemi: 0.06, env: 0.04, view: 0.12 }

function useOutsideLight(): OutsideLight {
  const day = useOutside((s) => Math.round(s.day * 50) / 50) // re-render on visible changes only
  const golden = useOutside((s) => Math.round(s.golden * 50) / 50)
  const sky = useOutside((s) => s.sky)
  const on = useScene((s) => s.lightsOn)
  return useMemo(() => {
    const o = mixLight(mixLight(NIGHT, DAY, day), GOLDEN, golden * 0.85)
    const w = WEATHER[sky]
    const hsl = { h: 0, s: 0, l: 0 }
    o.view.getHSL(hsl)
    o.view.setHSL(hsl.h, hsl.s * (1 - w.grey), hsl.l).multiplyScalar(w.dark)
    const out = { ...o, sunI: o.sunI * w.sun, winI: o.winI * w.win }
    if (on) return out
    return {
      ...out,
      winI: Math.min(out.winI, DRAWN.winI),
      sunI: DRAWN.sunI,
      hemi: Math.min(out.hemi, DRAWN.hemi),
      env: Math.min(out.env, DRAWN.env),
      view: out.view.clone().multiplyScalar(DRAWN.view),
    }
  }, [day, golden, sky, on])
}

/** Thunderstorms: every few seconds the window flashes white for a moment (a double flicker, like real lightning). */
function useLightning(apply: (flash: number) => void) {
  const storm = useOutside((s) => s.sky === 'storm')
  const next = useRef(3)
  const strike = useRef(-10)
  useFrame(({ clock }) => {
    if (!storm) return
    const t = clock.elapsedTime
    if (t > next.current) {
      strike.current = t
      next.current = t + 5 + Math.random() * 10
    }
    const dt = t - strike.current
    const flash = dt < 0 || dt > 0.6 ? 0 : Math.max(0, Math.exp(-dt * 14) + (dt > 0.18 ? 0.7 * Math.exp(-(dt - 0.18) * 10) : 0))
    apply(Math.min(1, flash))
  })
}

/**
 * The nook: light through the window that follows Raipur's sky, warm LED strips under the shelves, the mushroom
 * lamp and neon sign, candles (flickering, see Ambience) and a little warm fill so nothing goes black.
 */
export function Lights() {
  const { lamp, leds, neon } = useRoom()
  const on = useScene((s) => s.lightsOn)
  // the LED strips, lamp and neon: off while the replay (build.ts) hasn't reached the commit that lit the room
  const lamps = useBuild((s) => reached(s, 'fixtures')) && on
  const get = useThree((s) => s.get)
  const out = useOutsideLight()
  const windowLight = useRef<THREE.Light | null>(null)
  useLightning((flash) => {
    if (windowLight.current) windowLight.current.intensity = (out.winI + flash * 14) * (lite ? WIN_SPOT : 1)
  })

  // Nothing in the room moves, so shadows are drawn a few times after load and then left alone.
  useLayoutEffect(() => {
    const { gl } = get()
    gl.shadowMap.autoUpdate = false
    let frames = 4
    const id = setInterval(() => {
      gl.shadowMap.needsUpdate = true
      if (--frames <= 0) clearInterval(id)
    }, 300)
    return () => clearInterval(id)
  }, [get, on])

  // phones: the window's light comes from a wide soft spotlight instead of an area light (much cheaper per pixel)
  const winTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(-0.4, WIN.y - 0.7, WIN.z + 0.3)
    return o
  }, [])

  const dirTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(-0.2, 0.75, -0.4)
    return o
  }, [])

  return (
    <>
      <Environment files="./textures/sky_1k.hdr" environmentIntensity={out.env} />
      <hemisphereLight args={['#f4efe6', '#3a332b', out.hemi]} />

      {/* light from the garden (Raipur's time of day and weather): a big soft panel in the window plus a low
          light that casts the shadows */}
      {lite ? (
        <>
          <primitive object={winTarget} />
          <spotLight ref={(l) => void (windowLight.current = l)} target={winTarget} color={out.win} intensity={out.winI * WIN_SPOT}
            position={[WIN.x + 0.05, WIN.y + 0.1, WIN.z]} angle={1.15} penumbra={1} distance={7} decay={2} />
        </>
      ) : (
        <AimedRect target={[0, WIN.y - 0.3, WIN.z]} color={out.win} intensity={out.winI} width={WIN.w} height={WIN.h}
          position={[WIN.x + 0.02, WIN.y, WIN.z]} lightRef={(l) => (windowLight.current = l)} />
      )}
      <primitive object={dirTarget} />
      <directionalLight
        color={out.sun}
        intensity={out.sunI}
        position={[-6, 3.1, -0.15]}
        target={dirTarget}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={5}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
        shadow-camera-near={2}
        shadow-camera-far={12}
      />

      {/* warm LED strips washing the wall below each shelf */}
      {leds.map((l, i) =>
        lite ? (
          // phones: a warm downward spotlight under each shelf instead of an area light along it
          <LedSpot key={i} x={l.center.x} y={l.center.y} z={l.center.z} intensity={lamps ? LED_POINT : 0} />
        ) : (
        <AimedRect
          key={i}
          target={[l.center.x, l.center.y - 1, l.center.z - 0.05]}
          color="#ffb662"
          intensity={lamps ? 9 : 0}
          width={l.width}
          height={0.05}
          position={[l.center.x, l.center.y - 0.01, l.center.z]}
        />
      )
      )}
      <pointLight color="#ffc27a" intensity={lamps ? 0.9 : 0} distance={1.6} decay={2} position={[lamp.x, lamp.y, lamp.z + 0.05]} />
      <pointLight color="#fff0d0" intensity={lamps ? 0.35 : 0} distance={0.9} decay={2} position={[neon.x, neon.y, neon.z + 0.1]} />

      {/* warm fill from behind the camera, like the rest of a lamp-lit room */}
      <pointLight color="#ffe1bd" intensity={on ? 0.8 : 0.15} distance={4.5} decay={1.6} position={[0.6, 2.1, 1.4]} />
    </>
  )
}

/**
 * The garden outside the left window: a crop of the green_sanctuary panorama (blender/make_backplate.py).
 * The window is seen at a slant, so the photo is placed along the line of sight through it and turned to face
 * the default viewpoint; it's far enough away that the small camera sway barely shifts it.
 */
export function WindowView() {
  const { view } = useOutsideLight()
  const built = useBuild((s) => reached(s, 'window')) // the replay (build.ts): no garden before there's a window
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useLightning((flash) => mat.current?.color.copy(view).lerp(WHITE, flash * 0.8))
  const tex = useTexture('./textures/window_view.jpg', (t) => {
    t.colorSpace = THREE.SRGBColorSpace
  })
  const { pos, quat, w, h } = useMemo(() => {
    const eye = new THREE.Vector3(0.55, 1.5, 1.75)
    const win = new THREE.Vector3(WIN.x, WIN.y + 0.15, WIN.z)
    const D = 20
    const p = win.clone().add(win.clone().sub(eye).normalize().multiplyScalar(D))
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, p, new THREE.Vector3(0, 1, 0)))
    const width = 2 * (D + win.distanceTo(eye)) * Math.tan(THREE.MathUtils.degToRad(30))
    return { pos: p, quat: q, w: width, h: (width * 1600) / 2400 }
  }, [])
  return (
    <mesh position={pos} quaternion={quat} visible={built}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial ref={mat} map={tex} toneMapped={false} color={view} />
    </mesh>
  )
}

/** Soft contact shadows on the desk and floor, rendered once (the room is static). While the replay (build.ts) is
 * putting the room together they'd be shadows of things that aren't there yet, so they wait until it's furnished. */
export function GroundShadows() {
  const furnished = useBuild((s) => reached(s, 'screen'))
  return (
    <group visible={furnished}>
      <ContactShadows frames={1} position={[-0.115, 0.7605, -0.39]} scale={[2.75, 0.7]} resolution={1024} far={0.4}
        blur={2} opacity={0.6} color="#2a1d14" />
      <ContactShadows frames={1} position={[0.2, 0.002, 0.9]} scale={[3.4, 3.3]} resolution={512} far={1.2} blur={2.5}
        opacity={0.55} color="#2a1d14" />
    </group>
  )
}
