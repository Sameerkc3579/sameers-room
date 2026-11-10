import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { singlePage, useScene } from './store'
import { useT } from './i18n'
import { page as paper, shut } from './sound'

/**
 * start   closed and tiny, sitting on the object on the desk
 * rise    flies up to the middle of the page, still closed
 * open    the cover swings open on its spine: inside cover on the left, `page` on the right
 * shut    cover closes again
 * sink    back down onto the object, then the camera returns to the room
 */
type Phase = 'start' | 'rise' | 'open' | 'shut' | 'sink'

interface BookProps {
  /** names the book for screen readers and the Close button */
  label: string
  /** colour of the cloth cover (see book.css) */
  tint?: 'sage' | 'forest' | 'clay' | 'mustard'
  cover: ReactNode
  /** the inside of the cover: the left page of the open book (hidden on phones) */
  inside: ReactNode
  /** the right page */
  page: ReactNode
  /** extra layer over the right page, e.g. a leaf turning over */
  overlay?: ReactNode
}

export function Book({ label, tint = 'sage', cover, inside, page, overlay }: BookProps) {
  const t = useT()
  const point = useScene((s) => s.focusPoint)
  const setView = useScene((s) => s.setView)
  const [phase, setPhase] = useState<Phase>('start')
  const timers = useRef<number[]>([])
  const single = singlePage()

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
  const close = () => {
    timers.current.forEach(clearTimeout)
    shut()
    setPhase('shut')
    later(350, () => setPhase('sink'))
    later(600, () => setView('room'))
  }
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    const t = timers.current
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('rise')))
    t.push(
      window.setTimeout(() => {
        setPhase('open')
        paper()
      }, 380),
    )
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      t.forEach(clearTimeout)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // offset of the object from the middle of the page: the book rises from (and sinks back to) there
  const fx = (point?.x ?? window.innerWidth * 0.75) - window.innerWidth / 2
  const fy = (point?.y ?? window.innerHeight * 0.8) - window.innerHeight / 2
  const style = { '--fx': `${fx}px`, '--fy': `${fy}px` } as CSSProperties

  return (
    <div
      className={`book-stage ${phase}`}
      role="dialog"
      aria-label={label}
      onPointerDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className={`book ${phase}${single ? ' single' : ''}`} style={style}>
        <div className="book-page right">{phase !== 'start' && page}</div>
        {overlay}
        <div className="book-cover">
          <div className={`cover-front ${tint}`}>{cover}</div>
          <div className="cover-back">{!single && inside}</div>
        </div>
      </div>
      <button className="book-close" onClick={close} aria-label={`Close ${label}`}>
        {t('× Close', '× बंद करें')}
      </button>
    </div>
  )
}

/** The usual cover: a leaf, a title and two lines under it. */
export function Cover({ title, line, small }: { title: string; line: string; small: string }) {
  return (
    <>
      <span className="cover-leaf" aria-hidden>
        ❦
      </span>
      <h2>{title}</h2>
      <p>{line}</p>
      <small>{small}</small>
    </>
  )
}
