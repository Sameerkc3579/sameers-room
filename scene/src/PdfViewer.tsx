// The resume, drawn with pdf.js instead of the browser's PDF plug-in: it zooms (buttons, Ctrl + scroll, pinch,
// keyboard), pans by dragging, stays sharp at any zoom, keeps its links clickable and also works on phones.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { loadPdfLib } from './pdf'

const STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
const MIN = STEPS[0]
const MAX = STEPS[STEPS.length - 1]
const PAD = 12 // px around the pages inside the scroller (matches .pdf-scroll padding)
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z))

const open = async (src: string) => (await loadPdfLib()).getDocument({ url: src })

interface Link {
  href: string
  /** position on the page, in % */
  x: number
  y: number
  w: number
  h: number
}

/** One page: a canvas re-drawn at the current zoom × screen density, plus invisible links over the PDF's own. */
function Page({ page, width }: { page: PDFPageProxy; width: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [links, setLinks] = useState<Link[]>([])
  const base = useMemo(() => page.getViewport({ scale: 1 }), [page])

  useEffect(() => {
    let live = true
    page.getAnnotations().then((all) => {
      if (!live) return
      const found: Link[] = []
      for (const a of all) {
        const href = a.url ?? (a.unsafeUrl as string | undefined)
        if (a.subtype !== 'Link' || !href) continue
        const [x1, y1] = base.convertToViewportPoint(a.rect[0], a.rect[1])
        const [x2, y2] = base.convertToViewportPoint(a.rect[2], a.rect[3])
        found.push({
          href,
          x: (Math.min(x1, x2) / base.width) * 100,
          y: (Math.min(y1, y2) / base.height) * 100,
          w: (Math.abs(x2 - x1) / base.width) * 100,
          h: (Math.abs(y2 - y1) / base.height) * 100,
        })
      }
      setLinks(found)
    })
    return () => {
      live = false
    }
  }, [page, base])

  // CSS size follows the zoom instantly; the pixels catch up a moment later (re-rendering on every wheel tick
  // would stutter). Rendering goes to a spare canvas first so the page never flashes blank.
  useEffect(() => {
    if (width <= 0) return
    let task: RenderTask | null = null
    const timer = window.setTimeout(() => {
      const scale = (width * Math.min(window.devicePixelRatio || 1, 3)) / base.width
      const vp = page.getViewport({ scale })
      const spare = document.createElement('canvas')
      spare.width = Math.round(vp.width)
      spare.height = Math.round(vp.height)
      task = page.render({ canvas: spare, viewport: vp })
      task.promise
        .then(() => {
          const c = canvas.current
          if (!c) return
          c.width = spare.width
          c.height = spare.height
          c.getContext('2d')?.drawImage(spare, 0, 0)
        })
        .catch(() => {}) // cancelled by a newer zoom
    }, 90)
    return () => {
      clearTimeout(timer)
      task?.cancel()
    }
  }, [page, base, width])

  return (
    <div className="pdf-page" style={{ width, aspectRatio: `${base.width} / ${base.height}` }}>
      <canvas ref={canvas} />
      {links.map((l, i) => (
        <a
          key={i}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          title={l.href}
          style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%` }}
        />
      ))}
    </div>
  )
}

export function PdfViewer({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState<PDFPageProxy[]>([])
  const [failed, setFailed] = useState(false)
  const [fit, setFit] = useState(0) // page width (px) at which a whole page fits the scroller: "100%"
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(zoom)
  /** while zooming, keep this point of the document (in fit-relative units) under the same spot of the scroller */
  const anchor = useRef<{ dx: number; dy: number; px: number; py: number } | null>(null)

  useEffect(() => {
    let live = true
    let task: Awaited<ReturnType<typeof open>> | null = null
    open(src)
      .then((t) => (task = t).promise)
      .then(async (d) => {
        const ps = await Promise.all(Array.from({ length: d.numPages }, (_, i) => d.getPage(i + 1)))
        if (!live) return
        setDoc(d)
        setPages(ps)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
      task?.destroy() // also frees the document
    }
  }, [src])

  // "100%" = the first page fits the scroller entirely
  useEffect(() => {
    const el = box.current
    if (!el || !pages[0]) return
    const v = pages[0].getViewport({ scale: 1 })
    const measure = () => {
      const w = el.clientWidth - PAD * 2
      const h = el.clientHeight - PAD * 2
      setFit(Math.max(0, Math.min(w, (h * v.width) / v.height)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pages])

  /** zoom to z, keeping the point at (px, py) of the scroller (default: its centre) in place */
  const zoomTo = (z: number, px?: number, py?: number) => {
    const el = box.current
    const z0 = zoomRef.current
    z = clamp(z)
    if (!el || z === z0) return
    px ??= el.clientWidth / 2
    py ??= el.clientHeight / 2
    anchor.current = { dx: (el.scrollLeft + px) / z0, dy: (el.scrollTop + py) / z0, px, py }
    zoomRef.current = z
    setZoom(z)
  }
  const zoomRefFn = useRef(zoomTo)
  useEffect(() => {
    zoomRefFn.current = zoomTo
  })

  useLayoutEffect(() => {
    const el = box.current
    const a = anchor.current
    if (!el || !a) return
    el.scrollLeft = a.dx * zoom - a.px
    el.scrollTop = a.dy * zoom - a.py
    anchor.current = null
  }, [zoom])

  const step = (dir: 1 | -1) => {
    const z = zoomRef.current
    const next = dir > 0 ? STEPS.find((s) => s > z + 0.001) : [...STEPS].reverse().find((s) => s < z - 0.001)
    zoomTo(next ?? (dir > 0 ? MAX : MIN))
  }
  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  })

  // Ctrl/⌘ + wheel and trackpad pinch (which arrives as ctrl + wheel), two-finger pinch on touch screens,
  // and + / − / 0 on the keyboard (with or without Ctrl, like a PDF viewer)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const at = (x: number, y: number) => {
      const r = el.getBoundingClientRect()
      return [x - r.left, y - r.top] as const
    }
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const [px, py] = at(e.clientX, e.clientY)
      zoomRefFn.current(zoomRef.current * Math.exp(-e.deltaY * 0.0022), px, py)
    }
    let pinch: { d: number; z: number } | null = null
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoomRef.current }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      const [px, py] = at(
        (e.touches[0].clientX + e.touches[1].clientX) / 2,
        (e.touches[0].clientY + e.touches[1].clientY) / 2,
      )
      zoomRefFn.current((pinch.z * dist(e.touches)) / pinch.d, px, py)
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || (e.target as HTMLElement).closest?.('input, textarea')) return // typing in the chat box
      if (e.key === '+' || e.key === '=') stepRef.current(1)
      else if (e.key === '-' || e.key === '_') stepRef.current(-1)
      else if (e.key === '0') zoomRefFn.current(1)
      else return
      e.preventDefault() // keep Ctrl + / − zooming the resume, not the whole site
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
    }
  }, [doc])

  // drag with the mouse to move around a zoomed-in page
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null)
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = box.current
    if (!el || e.pointerType !== 'mouse' || e.button !== 0 || (e.target as HTMLElement).closest('a')) return
    drag.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop }
    el.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = box.current
    const d = drag.current
    if (!el || !d) return
    el.scrollLeft = d.l - (e.clientX - d.x)
    el.scrollTop = d.t - (e.clientY - d.y)
  }
  const endDrag = () => {
    drag.current = null
  }

  if (failed)
    return (
      <div className="book-fallback">
        <p>The resume couldn't be shown here.</p>
        <a href={src} target="_blank" rel="noreferrer">
          Open the resume ↗
        </a>
      </div>
    )

  const width = Math.round(fit * zoom)
  return (
    <div className="pdf-viewer">
      <div className="pdf-bar" role="toolbar" aria-label="Zoom">
        <button onClick={() => step(-1)} disabled={zoom <= MIN} aria-label="Zoom out" title="Zoom out (−)">
          −
        </button>
        <button className="pdf-pct" onClick={() => zoomTo(1)} title="Fit the page (0)">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => step(1)} disabled={zoom >= MAX} aria-label="Zoom in" title="Zoom in (+)">
          +
        </button>
        <span className="pdf-sep" />
        <button className="pdf-fit" onClick={() => zoomTo(1)} disabled={zoom === 1}>
          Fit
        </button>
      </div>
      <div
        ref={box}
        className={`pdf-scroll${zoom > 1 ? ' zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {!doc && <div className="pdf-loading">Opening the resume…</div>}
        <div className="pdf-pages">
          {fit > 0 && pages.map((p) => <Page key={p.pageNumber} page={p} width={width} />)}
        </div>
      </div>
    </div>
  )
}
