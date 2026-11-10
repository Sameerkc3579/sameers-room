import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'
import { useScene } from './store'
import { useRoom } from './roomModel'
import { ANCHORS, INTERACTABLES } from './interactables'
import { useT } from './i18n'
import { END, PIECE_AT, useBuild } from './build'

const coarse = window.matchMedia('(pointer: coarse)').matches
const INTRO_MS = 7000
let introShown = false // labels open on arrival only, not every time you come back from the computer

const HINDI: Record<string, string> = {
  monitor: 'कंप्यूटर चलाएँ',
  books: 'प्रोजेक्ट्स',
  quote: 'मेरे बारे में',
  notebooks: 'रिज़्यूमे',
  stats: 'मेरे आँकड़े',
  guestbook: 'गेस्टबुक',
}

/*
 * The hint dots are plain page elements in one layer over the canvas (Hints, below), and HintTracker, inside the
 * scene, moves each one onto its object every frame with a single transform. (drei's <Html> per dot also rewrote
 * each one's display and stacking order every frame, which cost phones a third of their frame rate.)
 */
const useHintKeys = create<{ keys: string[] }>(() => ({ keys: [] }))
const pins = new Map<string, HTMLDivElement>()
const placed = new Map<string, string>() // the last transform per dot, so a remounted dot starts in place
const OFF = 'translate3d(-9999px, 0, 0)'
// a dot whose object is off the side of the screen (portrait phones see part of the room) waits at the edge, still
// tappable; tapping it glides there. Kept clear of the corners' chips and the dock.
const EDGE = 26
const TOP = 30
const BOTTOM = 96

export function HintTracker() {
  const { anchors } = useRoom()
  const size = useThree((s) => s.size)
  const v = useMemo(() => new THREE.Vector3(), [])
  useLayoutEffect(() => {
    useHintKeys.setState({ keys: Object.keys(anchors).filter((k) => !ANCHORS[k]?.hidden) })
  }, [anchors])

  useFrame(({ camera }) => {
    for (const [key, p] of Object.entries(anchors)) {
      const pin = pins.get(key)
      if (!pin) continue
      v.copy(p).project(camera)
      const sx = ((v.x + 1) / 2) * size.width
      const sy = ((1 - v.y) / 2) * size.height
      const x = Math.min(size.width - EDGE, Math.max(EDGE, sx))
      const y = Math.min(size.height - BOTTOM, Math.max(TOP, sy))
      const tf = v.z > 1 ? OFF : `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      pin.classList.toggle('edge', x !== sx)
      if (placed.get(key) !== tf) {
        pin.style.transform = tf
        placed.set(key, tf)
      }
      // labels grow to the right of their dot, except near the right edge of the screen, where they flip left
      const left = v.x > 0.3 || sx > size.width - EDGE
      const button = pin.firstElementChild as HTMLElement | null
      if (button && button.classList.contains('left') !== left) button.classList.toggle('left', left)
    }
  })
  return null
}

/**
 * A softly pulsing dot on every clickable object so visitors know what they can use.
 * Labels show for the first few seconds, then fold into the dots; hovering the object (or the dot) opens its
 * label again. Touch screens have no hover, so there the labels stay open. The dots are buttons too.
 */
/*
 * Touch taps are handled on the finger lifting (pointerup) rather than waiting for the browser's click: some phones
 * drop that click when the finger wobbles a little, or when the element moved under it (these dots move with the
 * camera every frame). A mouse still uses the click.
 */
let pressed: { id: number; x: number; y: number } | null = null
let tappedAt = 0

export function Hints() {
  const keys = useHintKeys((s) => s.keys)
  // the replay (build.ts) shows the dots for their own commit and once the room is whole again; in its close-ups
  // they'd only crowd the edges of the screen
  const dotsBuilt = useBuild((s) => s.at === null || s.at === PIECE_AT.hints || s.at === END)
  const inRoom = useScene((s) => s.view === 'room' && s.tour === null) && dotsBuilt
  const hover = useScene((s) => s.hover)
  const playing = useScene((s) => s.music.playing)
  const lightsOn = useScene((s) => s.lightsOn)
  const setHover = useScene((s) => s.setHover)
  const t = useT()
  const used = useScene((s) => s.used)
  const markUsed = useScene((s) => s.markUsed)
  const [intro, setIntro] = useState(!introShown)
  const ready = useScene((s) => s.shown) && keys.length > 0 // (the intro starts once the room is drawn)

  // the intro starts once the room is there to look at
  useEffect(() => {
    if (introShown || !ready) return
    const timer = setTimeout(() => {
      introShown = true
      setIntro(false)
    }, INTRO_MS)
    return () => clearTimeout(timer)
  }, [ready])

  if (!inRoom || !ready) return null

  const use = (key: string) => {
    markUsed(key)
    setHover(null)
    INTERACTABLES[key].action()
  }

  const label = (key: string) => {
    if (key === 'headphones') return playing ? t('Pause lo-fi', 'लो-फ़ाई रोकें') : t('Play lo-fi', 'लो-फ़ाई चलाएँ')
    if (key === 'lamp') return lightsOn ? t('Lights off', 'लाइट बंद करें') : t('Lights on', 'लाइट जलाएँ')
    return t(INTERACTABLES[key].label, HINDI[key] ?? INTERACTABLES[key].label)
  }

  return (
    <div className="hint-layer">
      {keys.map((key) => {
        const open = intro || coarse || hover === key
        return (
          <div
            key={key}
            className="hint-pin"
            ref={(el) => {
              if (el) {
                el.style.transform = placed.get(key) ?? OFF
                pins.set(key, el)
              } else pins.delete(key)
            }}
          >
            <button
              className={`hint${open ? ' open' : ''}${used.includes(key) ? ' used' : ''}`}
              aria-label={label(key)}
              // hover is for mice: on a touch screen it would also lean the camera and repaint the room mid-tap
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(key)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse') return
                pressed = { id: e.pointerId, x: e.clientX, y: e.clientY }
                e.currentTarget.setPointerCapture?.(e.pointerId) // the lift lands here even if the dot moved
              }}
              onPointerUp={(e) => {
                const p = pressed
                pressed = null
                if (!p || p.id !== e.pointerId || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 32) return
                tappedAt = performance.now()
                use(key)
              }}
              onPointerCancel={() => (pressed = null)}
              onClick={() => {
                if (performance.now() - tappedAt < 800) return // already handled on the finger lifting
                use(key)
              }}
            >
              <span className="hint-dot" />
              <span className="hint-label">{label(key)}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
