// Polaroid photo mode (polaroid.ts): PhotoRig takes the picture inside the 3D scene, PhotoCard shows the flash and the
// print developing, with Download and Share.
import { useEffect, useMemo, type CSSProperties } from 'react'
import { addAfterEffect, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePhoto, closePhoto, printPolaroid, SITE } from './polaroid'
import { t, useT } from './i18n'

/** a photo's shape: what's on screen, cropped no wider than 3:2 and no taller than 4:5 */
const shape = (w: number, h: number) => THREE.MathUtils.clamp(w / h, 0.8, 1.5)

/** the middle of the frame that's on the canvas right now, at most 1800 px along its long side */
function grab(src: HTMLCanvasElement, aspect: number) {
  const [cw, ch] = src.width / src.height > aspect ? [src.height * aspect, src.height] : [src.width, src.width / aspect]
  const k = Math.min(1, 1800 / Math.max(cw, ch))
  const out = Object.assign(document.createElement('canvas'), { width: Math.round(cw * k), height: Math.round(ch * k) })
  out.getContext('2d')!.drawImage(src, (src.width - cw) / 2, (src.height - ch) / 2, cw, ch, 0, 0, out.width, out.height)
  return out
}

/**
 * Takes the picture: exactly the frame on screen, effects and all, read straight after it's drawn (the canvas only
 * holds it until the page is painted). Phones draw the room at a low pixel density to keep it smooth, so for the
 * photo the density goes up for a few frames, under the flash, then back.
 */
export function PhotoRig() {
  const get = useThree((s) => s.get)
  const taking = usePhoto((s) => s.taking)
  useEffect(() => {
    if (!taking) return
    const { size, viewport, setDpr } = get()
    const aspect = shape(size.width, size.height)
    // the photo's size on the page, and the density that makes it about 1500 px along its long side
    const [cw, ch] = size.width / size.height > aspect ? [size.height * aspect, size.height] : [size.width, size.width / aspect]
    const before = viewport.dpr
    const sharp = Math.min(3, Math.max(before, 1500 / Math.max(cw, ch)))
    const boost = sharp > before + 0.05
    if (boost) setDpr(sharp)
    let frames = 0
    let stop = addAfterEffect(() => {
      if (++frames < (boost ? 3 : 1)) return // at a new density, the canvas (and the effects' buffers) catch up first
      stop()
      stop = () => {}
      const photo = grab(get().gl.domElement, aspect)
      if (boost) get().setDpr(before)
      printPolaroid(photo).then(
        (print) => usePhoto.setState({ print, taking: false }),
        () => usePhoto.setState({ taking: false }),
      )
    })
    return () => stop()
  }, [taking, get])
  return null
}

export function PhotoCard() {
  const print = usePhoto((s) => s.print)
  const flashes = usePhoto((s) => s.flashes)
  useT() // redraw in the visitor's language

  useEffect(() => {
    document.body.classList.toggle('photo-open', !!print)
    if (!print) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePhoto()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [print])

  // phones (and some desktops) can hand the print straight to another app
  const share = useMemo(() => {
    if (!print || !navigator.canShare) return null
    const data = { files: [new File([print.blob], print.name, { type: 'image/jpeg' })], title: "Sameer's room", text: `https://${SITE}` }
    return navigator.canShare(data) ? data : null
  }, [print])

  return (
    <>
      {flashes > 0 && <div key={flashes} className="photo-flash" aria-hidden />}
      {print && (
        <div className="photo-layer" onClick={closePhoto}>
          <figure
            className="polaroid"
            onClick={(e) => e.stopPropagation()}
            style={{ '--x': `${print.hole.x * 100}%`, '--y': `${print.hole.y * 100}%`, '--w': `${print.hole.w * 100}%`, '--h': `${print.hole.h * 100}%` } as CSSProperties}
          >
            <img src={print.url} alt={t("A polaroid of Sameer's room", 'Sameer के कमरे की एक पोलरॉइड फ़ोटो')} />
            {/* the picture comes up out of the grey, like a real instant print */}
            <i className="polaroid-develop" aria-hidden />
          </figure>
          <div className="photo-actions" onClick={(e) => e.stopPropagation()}>
            <a className="cb-btn primary" href={print.url} download={print.name}>
              {t('Download', 'डाउनलोड करें')} ↓
            </a>
            {share && (
              <button className="cb-btn" onClick={() => navigator.share(share).catch(() => {})}>
                {t('Share', 'शेयर करें')}
              </button>
            )}
            <button className="cb-btn ghost" onClick={closePhoto}>
              {t('Back to the room', 'कमरे में वापस')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
