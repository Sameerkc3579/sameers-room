import { Suspense, lazy, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { Room } from './Room'
import { Vine } from './Vine'
import { HuntGlow } from './HuntGlow'
import { Fireflies } from './Fireflies'
import { Flashlight, TorchHint } from './Flashlight'
import { GroundShadows, Lights, WindowView } from './Lights'
import { Ambience } from './Ambience'
import { HintTracker, Hints } from './Hints'
import { CameraRig } from './CameraRig'
import { OsLayer } from './OsLayer'
import { Books } from './Books'
import { Rain } from './Rain'
import { LiveData } from './LiveData'
import { Overlay } from './Overlay'
import { Chat } from './Chat'
import { TourCard } from './TourCard'
import { BuildRig } from './BuildRig'
import { BuildCard } from './BuildCard'
import { TimeDial } from './TimeDial'
import { PhotoCard, PhotoRig } from './Photo'
import { useScene } from './store'
import { useT } from './i18n'
import { lite } from './device'

const Effects = lazy(() => import('./Effects'))
const wantsEffects = new URLSearchParams(location.search).has('fx')

/**
 * Compiles every shader in the background (KHR_parallel_shader_compile) before the first frame. Compiling them
 * on the first render instead froze the whole page for many seconds on a first visit, on phones and desktops
 * alike. The loader stays up meanwhile and the page stays responsive.
 */
function Precompile() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      useScene.setState({ ready: true })
    }
    gl.compileAsync(scene, camera).then(finish, finish)
    const t = setTimeout(finish, 20_000) // never keep the room hidden for good
    return () => clearTimeout(t)
  }, [gl, scene, camera])
  // the first frames still do one-off work (shadow maps, the contact shadows): let them happen behind the loader
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current === 3) useScene.setState({ shown: true })
  })
  return null
}

function Loader() {
  const { progress, active } = useProgress()
  const shown = useScene((s) => s.shown)
  const t = useT()
  return (
    <div className={`loader${active || !shown ? '' : ' done'}`} aria-live="polite">
      <div className="loader-card">
        <h1>{t("Sameer's Room", 'Sameer का कमरा')}</h1>
        <p>{t("A desk by the window, a computer that works, and everything I've built.", 'खिड़की के पास एक डेस्क, एक चलता हुआ कंप्यूटर, और वह सब जो मैंने बनाया है।')}</p>
        <div className="loader-bar">
          <i style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <small>
          {progress < 100
            ? t(`Setting up the room… ${Math.round(progress)}%`, `कमरा सज रहा है… ${Math.round(progress)}%`)
            : !shown
              ? t('Switching the lights on…', 'लाइटें जल रही हैं…')
              : t('Welcome in', 'स्वागत है')}
        </small>
      </div>
    </div>
  )
}

export default function App() {
  const high = useScene((s) => s.quality === 'high')
  const ready = useScene((s) => s.ready)
  const setQuality = useScene((s) => s.setQuality)
  // pixel density follows how the device copes: one that can't hold the frame rate renders a little softer rather
  // than dropping any animation (desktops 1–1.5×; phones start at 1× and go 0.75–1.25×)
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio, lite ? 1 : 1.5))
  return (
    <>
      <Canvas
        // nothing is drawn until Precompile has every shader ready
        frameloop={ready ? 'always' : 'never'}
        // PCF, which is what three.js turns R3F's default (PCF-soft, deprecated) into on the first shadow pass anyway;
        // asking for it up front keeps that switch from recompiling every shader right after Precompile
        shadows="percentage"
        // render at the screen's real pixel density (a 125%-scaled laptop was getting a 1× canvas stretched up)
        dpr={high ? Math.min(window.devicePixelRatio, 2) : dpr}
        camera={{ position: [0.55, 1.5, 1.75], fov: 50, near: 0.05, far: 60 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }}
        // clicking empty space while a panel is open closes it
        onPointerMissed={() => useScene.getState().view === 'focus' && useScene.getState().setView('room')}
      >
        <color attach="background" args={['#1d2419']} />
        {/* start lean; step up to live AO + sharper pixels only if this GPU has headroom */}
        <PerformanceMonitor
          bounds={() => [40, 58]}
          flipflops={4}
          onIncline={() => {
            // the ambient-occlusion pass (Effects.tsx) is a desktop extra: on phones, headroom goes to sharpness
            if (!lite) setQuality('high')
            setDpr((d) => Math.min(window.devicePixelRatio, lite ? 1.25 : 1.5, d + 0.25))
          }}
          onDecline={() => {
            setQuality('normal')
            setDpr((d) => Math.max(lite ? 0.75 : 1, d - 0.25))
          }}
          onFallback={() => setQuality('normal')}
        />
        <Suspense fallback={null}>
          <Lights />
          <WindowView />
          <Room />
          <Vine />
          <HuntGlow />
          <Fireflies />
          <Flashlight />
          <GroundShadows />
          <Ambience />
          <Rain />
          <HintTracker />
          <CameraRig />
          <BuildRig />
          <PhotoRig />
          {(high || wantsEffects) && <Effects />}
          <Precompile />
        </Suspense>
      </Canvas>
      <div className="vignette" />
      <Hints />
      <Overlay />
      <OsLayer />
      <Books />
      <TourCard />
      <BuildCard />
      <TimeDial />
      <PhotoCard />
      <TorchHint />
      <LiveData />
      <Chat />
      <Loader />
    </>
  )
}
