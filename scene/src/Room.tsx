import { useLayoutEffect } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useScene } from './store'
import { INTERACTABLES, keyOf } from './interactables'
import { useRoom } from './roomModel'
import { lite } from './device'

const HIGHLIGHT = new THREE.Color('#ffb070')

export function Room() {
  const { scene } = useRoom()
  const hover = useScene((s) => s.hover)
  const view = useScene((s) => s.view)
  const setHover = useScene((s) => s.setHover)

  // The monitor plays a short recording of SameerOS while you're in the room (the live OS takes over when
  // you zoom in). The still image stays until the video can play, and if it never can.
  useLayoutEffect(() => {
    const screen = scene.getObjectByName('Screen') as THREE.Mesh | undefined
    const mat = screen?.material as THREE.MeshBasicMaterial | undefined
    if (!mat) return
    const video = Object.assign(document.createElement('video'), {
      src: './textures/os_loop.webm',
      muted: true,
      loop: true,
      playsInline: true,
      crossOrigin: 'anonymous',
    })
    // Phones show the monitor a few hundred pixels wide, so there the video is drawn into a quarter-size canvas
    // at up to 20 fps: re-uploading (and re-mipmapping) the full 1600×1000 frame 30 times a second is a large
    // share of a phone's frame time.
    const small = window.matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700
    let tex: THREE.Texture
    let stopDrawing = () => {}
    if (small) {
      const c = Object.assign(document.createElement('canvas'), { width: 800, height: 500 })
      const g = c.getContext('2d')!
      tex = new THREE.CanvasTexture(c)
      let last = 0
      let handle = 0
      const draw = () => {
        const now = performance.now()
        if (now - last >= 48 && video.readyState >= 2) {
          last = now
          g.drawImage(video, 0, 0, c.width, c.height)
          tex.needsUpdate = true
        }
        handle = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(draw) : window.setTimeout(draw, 50)
      }
      draw()
      stopDrawing = () => (video.cancelVideoFrameCallback ? video.cancelVideoFrameCallback(handle) : clearTimeout(handle))
    } else tex = new THREE.VideoTexture(video)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = false
    // the recording is shown a few hundred pixels wide: mipmaps keep small text crisp instead of shimmering
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.anisotropy = 8
    const still = mat.map
    const onPlaying = () => {
      mat.map = tex
      mat.needsUpdate = true
    }
    video.addEventListener('playing', onPlaying)
    video.play().catch(() => {})
    return () => {
      video.pause()
      stopDrawing()
      video.removeEventListener('playing', onPlaying)
      mat.map = still
      tex.dispose()
    }
  }, [scene])

  // hover highlight
  useLayoutEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !keyOf(o)) return
      const on = keyOf(o) === hover
      for (const m of [o.material].flat()) {
        if ((m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshLambertMaterial) && m.name !== 'LampBulb') {
          m.emissive.copy(on ? HIGHLIGHT : new THREE.Color(0))
          m.emissiveIntensity = on ? 0.35 : 1
        }
      }
    })
    document.body.style.cursor = hover ? 'pointer' : ''
  }, [hover, scene])

  const interactive = view === 'room'
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return
    e.stopPropagation()
    const k = keyOf(e.object)
    if (k !== useScene.getState().hover) setHover(k)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return
    const k = keyOf(e.object)
    if (!k) return
    e.stopPropagation()
    useScene.getState().markUsed(k)
    INTERACTABLES[k].action()
  }

  return (
    <primitive
      object={scene}
      // touch screens have no hover: testing every finger movement against the whole room was a big share of
      // a phone's frame time, so there only taps are checked
      onPointerMove={lite ? undefined : onMove}
      onPointerOut={lite ? undefined : () => interactive && setHover(null)}
      onClick={onClick}
    />
  )
}
