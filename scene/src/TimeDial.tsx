// The desk clock's dial: tap the clock (or ask the chat) and turn the room to any hour, in any weather. The light
// through the window, the garden, the rain, the birds and crickets and the clock's own face all follow (raipur.ts).
// Noon is at the top and midnight at the bottom, so the knob rides the sun's arc; a notch marks Raipur's real time,
// and the knob snaps to it, back to live. The room keeps the visitor's pick after the card closes, until they go
// back to Raipur's time (here, on the Raipur chip, or from the chat).
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useScene, singlePage } from './store'
import { useChat } from './agent'
import { useBuild } from './build'
import { backToNow, clockText, closeDial, hoursBetween, pickTime, picked, skyText, useDial, useOutside, type Sky } from './raipur'
import { notch } from './sound'
import { t, useT } from './i18n'

const cloud = 'M7.5 17h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.7 1.2A2.9 2.9 0 0 0 7.5 17z'
const raincloud = 'M7.5 13.5h9a3.3 3.3 0 0 0 .4-6.6 4.8 4.8 0 0 0-9.3 1.1 2.75 2.75 0 0 0-.1 5.5z'
const SKIES: { sky: Sky; name: [string, string]; icon: ReactNode }[] = [
  {
    sky: 'clear',
    name: ['Clear', 'साफ़'],
    icon: (
      <>
        <circle cx="12" cy="12" r="3.6" />
        <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" />
      </>
    ),
  },
  { sky: 'cloudy', name: ['Cloudy', 'बादल'], icon: <path d={cloud} /> },
  { sky: 'fog', name: ['Haze', 'धुंध'], icon: <path d="M4 8.5h13M6.5 12.5h13.5M4 16.5h11" /> },
  {
    sky: 'rain',
    name: ['Rain', 'बारिश'],
    icon: (
      <>
        <path d={raincloud} />
        <path d="M9 16.5 8 19.5M12.5 16.5l-1 3M16 16.5l-1 3" />
      </>
    ),
  },
  {
    sky: 'storm',
    name: ['Storm', 'तूफ़ान'],
    icon: (
      <>
        <path d={raincloud} />
        <path d="M12.8 15.5 10.6 18.6h2.8l-1.9 3" />
      </>
    ),
  },
]

/** the colours round the dial: night at the bottom, the warm sunrise and sunset, daylight across the top */
function ring(sunrise: number, sunset: number) {
  const at = (h: number) => `${((h / 24) * 100).toFixed(2)}%`
  const night = '#27344f'
  const warm = '#ef9d5c'
  const day = '#e9e6c4'
  return `conic-gradient(from 180deg, ${night} 0%, ${night} ${at(sunrise - 0.9)}, ${warm} ${at(sunrise)}, ${day} ${at(
    sunrise + 1.4,
  )}, ${day} ${at(sunset - 1.4)}, ${warm} ${at(sunset)}, ${night} ${at(sunset + 0.9)}, ${night} 100%)`
}

/** degrees clockwise from the top: noon up, midnight down */
const angle = (hour: number) => (hour - 12) * 15

/** turns the room's clock to `hour`, clicking past each hour; close to Raipur's real time it snaps back to live */
function setHour(hour: number) {
  const s = useOutside.getState()
  if (Math.floor(hour) !== Math.floor(s.hour)) notch()
  pickTime({ hour: Math.abs(hoursBetween(s.real.hour, hour)) < 0.17 ? null : hour })
}

export function TimeDial() {
  const open = useDial((s) => s.open)
  const o = useOutside()
  useT() // redraw in the visitor's language
  const face = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)

  // anywhere else (a book, the computer, the tour, the replay) and the card goes; the room keeps the pick
  const away = useScene((s) => s.view !== 'room' || s.tour !== null)
  const replay = useBuild((s) => s.at !== null)
  useEffect(() => {
    if (away || replay) closeDial()
  }, [away, replay])

  useEffect(() => {
    document.body.classList.toggle('dialing', open)
    if (!open) return
    if (singlePage()) useChat.getState().setOpen(false) // phones: the chat would cover the room
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target as HTMLElement).closest?.('input, textarea') && closeDial()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const turn = (x: number, y: number) => {
    const r = face.current!.getBoundingClientRect()
    const dx = x - (r.left + r.width / 2)
    const dy = y - (r.top + r.height / 2)
    if (Math.hypot(dx, dy) < r.width * 0.15) return // the middle has no direction
    const hour = 12 + (Math.atan2(dx, -dy) / Math.PI) * 12
    setHour(((Math.round(hour * 12) / 12) % 24 + 24) % 24) // five-minute steps
  }
  const own = picked(o)
  const night = o.day < 0.3
  const style = { '--a': `${angle(o.hour)}deg`, '--now': `${angle(o.real.hour)}deg` } as CSSProperties

  return (
    <section className="tour dial" aria-label={t('Time in the room', 'कमरे का समय')}>
      <header>
        <p className="tour-kicker">{t('Time in the room', 'कमरे का समय')}</p>
        <button className="tour-x" onClick={closeDial} aria-label={t('Close', 'बंद करें')}>
          ×
        </button>
      </header>
      <div className="dial-body">
        <div
          ref={face}
          className="dial-face"
          style={style}
          role="slider"
          tabIndex={0}
          aria-label={t('Time of day', 'दिन का समय')}
          aria-valuemin={0}
          aria-valuemax={1439}
          aria-valuenow={Math.floor(o.hour * 60)}
          aria-valuetext={clockText(o.hour)}
          onPointerDown={(e) => {
            drag.current = e.pointerId
            e.currentTarget.setPointerCapture(e.pointerId)
            turn(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => drag.current === e.pointerId && turn(e.clientX, e.clientY)}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={(e) => {
            const step = ({ ArrowRight: 0.25, ArrowUp: 0.25, ArrowLeft: -0.25, ArrowDown: -0.25, PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key]
            if (!step) return
            e.preventDefault()
            setHour((((Math.round((o.hour + step) * 4) / 4) % 24) + 24) % 24)
          }}
        >
          <div className="dial-ring" style={{ background: ring(o.sunrise, o.sunset) }} />
          <i className="dial-now" title={t('Raipur right now', 'रायपुर में अभी')} />
          <svg className="dial-sun" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
          </svg>
          <svg className="dial-moon" viewBox="0 0 24 24" aria-hidden>
            <path d="M15.5 4.5a8 8 0 1 0 4 11.6A6.5 6.5 0 0 1 15.5 4.5z" />
          </svg>
          <div className="dial-center" aria-hidden>
            <b>{clockText(o.hour)}</b>
            <small>{skyText(o.sky, o.day, o.golden, o.hour)}</small>
          </div>
          <span className={`dial-knob${night ? ' night' : ''}`} aria-hidden />
        </div>
        <div className="dial-side">
          <p className="dial-tip">{t('Turn the dial to any hour, then pick the weather.', 'डायल को किसी भी घंटे पर घुमाएँ, फिर मौसम चुनें।')}</p>
          <div className="dial-skies" role="radiogroup" aria-label={t('Weather', 'मौसम')}>
            {SKIES.map((s) => (
              <button
                key={s.sky}
                className={`dial-sky${o.sky === s.sky ? ' on' : ''}`}
                role="radio"
                aria-checked={o.sky === s.sky}
                aria-label={t(...s.name)}
                // Raipur's own weather follows the live forecast again
                onClick={() => pickTime({ sky: s.sky === o.real.sky ? null : s.sky })}
                title={s.sky === o.real.sky ? t('Raipur right now', 'रायपुर में अभी') : undefined}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  {s.sky === 'clear' && night ? <path d="M15.5 4.5a8 8 0 1 0 4 11.6A6.5 6.5 0 0 1 15.5 4.5z" /> : s.icon}
                </svg>
                <span className="dial-sky-name">{t(...s.name)}</span>
                {s.sky === o.real.sky && <i className="dial-live" aria-hidden />}
              </button>
            ))}
          </div>
          {own ? (
            <button className="cb-btn dial-back" onClick={backToNow}>
              ↺ <span className="dial-back-long">{t('Back to Raipur now', 'अभी के रायपुर पर वापस')}</span>
              <span className="dial-back-short">{t('Raipur now', 'अभी का रायपुर')}</span>
              <span className="dial-back-time"> · {clockText(o.real.hour)}</span>
            </button>
          ) : (
            <p className="dial-live-note">
              <span className="raipur-dot" aria-hidden />
              {t('Live: Raipur right now', 'लाइव: रायपुर में अभी')}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
