// The room is in Raipur: the light through the window follows Raipur's clock and its live weather (Open-Meteo,
// no key needed). Lights.tsx and Rain.tsx read this; the overlay shows it as a little chip. Visitors can also turn
// the desk clock (TimeDial.tsx) to any hour and weather they like, until they go back to Raipur's own.
// Preview any moment with URL params, e.g.  ?raipur=19:10&sky=storm   (sky: clear | cloudy | fog | rain | storm)
import { create } from 'zustand'
import { t } from './i18n'

export type Sky = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm'

/** an hour and weather picked on the desk clock; null where the room follows Raipur */
export interface Choice {
  hour: number | null
  sky: Sky | null
}

interface Outside {
  /** the room's time in hours (14.5 = 2:30 pm), and Raipur's weekday (0 = Sunday) */
  hour: number
  weekday: number
  sunrise: number
  sunset: number
  sky: Sky
  /** °C, null until the weather has loaded */
  temp: number | null
  /** 0 = night … 1 = full daylight */
  day: number
  /** 0 … 1: how close to sunrise / sunset (warm, low light) */
  golden: number
  /** Raipur as it really is right now, whatever the room shows (the chat answers with this) */
  real: { hour: number; sky: Sky }
  /** what the visitor picked on the desk clock */
  pick: Choice
}

const RAIPUR = { lat: 21.2514, lon: 81.6296 }
const IST = 5.5 // Raipur is UTC+5:30 all year
const params = new URLSearchParams(location.search)

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** daylight and golden-hour amounts for a time of day */
function light(hour: number, sunrise: number, sunset: number) {
  const day = smooth(sunrise - 0.4, sunrise + 0.9, hour) * (1 - smooth(sunset - 0.9, sunset + 0.4, hour))
  const near = Math.min(Math.abs(hour - sunrise), Math.abs(hour - sunset))
  return { day, golden: Math.max(0, 1 - near / 1.1) }
}

function raipurNow() {
  const forced = /^(\d{1,2}):(\d{2})$/.exec(params.get('raipur') ?? '')
  const d = new Date(Date.now() + IST * 3600_000) // read with getUTC* = Raipur wall clock
  const hour = forced ? Number(forced[1]) + Number(forced[2]) / 60 : d.getUTCHours() + d.getUTCMinutes() / 60
  return { hour, weekday: d.getUTCDay() }
}

/** WMO weather code -> what we can show through the window */
function skyOf(code: number): Sky {
  if (code >= 95) return 'storm'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 2) return 'cloudy'
  return 'clear'
}

const forcedSky = (['clear', 'cloudy', 'fog', 'rain', 'storm'] as Sky[]).find((s) => s === params.get('sky'))

/** what the room shows: Raipur's time and weather, or the visitor's pick */
function shown({ real, pick, sunrise, sunset }: Pick<Outside, 'real' | 'pick' | 'sunrise' | 'sunset'>) {
  const hour = pick.hour ?? real.hour
  return { hour, sky: pick.sky ?? real.sky, ...light(hour, sunrise, sunset) }
}

export const useOutside = create<Outside>(() => {
  const { hour, weekday } = raipurNow()
  // typical Raipur sun times until the forecast arrives
  const base = { weekday, sunrise: 6.1, sunset: 17.6, temp: null, real: { hour, sky: forcedSky ?? 'clear' }, pick: { hour: null, sky: null } }
  return { ...base, ...shown(base) }
})

function update(change: Partial<Outside>) {
  useOutside.setState({ ...change, ...shown({ ...useOutside.getState(), ...change }) })
}

function tick() {
  const { hour, weekday } = raipurNow()
  update({ weekday, real: { ...useOutside.getState().real, hour } })
}

async function fetchWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${RAIPUR.lat}&longitude=${RAIPUR.lon}` +
    '&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=Asia%2FKolkata&forecast_days=1'
  const d = await (await fetch(url)).json()
  const hours = (iso: string) => {
    const [h, m] = iso.slice(11, 16).split(':').map(Number)
    return h + m / 60
  }
  const sunrise = d.daily?.sunrise?.[0] ? hours(d.daily.sunrise[0]) : 6.1
  const sunset = d.daily?.sunset?.[0] ? hours(d.daily.sunset[0]) : 17.6
  update({
    sunrise,
    sunset,
    real: { ...useOutside.getState().real, sky: forcedSky ?? skyOf(Number(d.current?.weather_code ?? 0)) },
    temp: typeof d.current?.temperature_2m === 'number' ? Math.round(d.current.temperature_2m) : null,
  })
  tick()
}

let started = false
/** Keeps the clock ticking and the weather fresh (every 15 minutes). */
export function startOutside() {
  if (started) return
  started = true
  setInterval(tick, 30_000)
  const load = () => fetchWeather().catch(() => {}) // offline: clear skies, typical sun times
  load()
  setInterval(load, 15 * 60_000)
}

/* ---------- the desk clock (TimeDial.tsx): the visitor's own hour and weather ---------- */

export const picked = (s: Outside) => s.pick.hour !== null || s.pick.sky !== null

/** Raipur as it really is, whatever the desk clock shows (the chat answers with this) */
export function raipurNowReal() {
  const s = useOutside.getState()
  return { ...s, ...s.real, ...light(s.real.hour, s.sunrise, s.sunset) }
}

/** the dial's card is open (tapping the clock opens it) */
export const useDial = create<{ open: boolean }>(() => ({ open: false }))
export const openDial = () => useDial.setState({ open: true })
export const closeDial = () => useDial.setState({ open: false })

let glide = 0
/** sets the room's hour and/or weather (null: Raipur's own again) */
export function pickTime(c: Partial<Choice>) {
  if ('hour' in c) cancelAnimationFrame(glide)
  update({ pick: { ...useOutside.getState().pick, ...c } })
}

/** the shorter way round the clock from one hour to another (-12 … 12) */
export const hoursBetween = (from: number, to: number) => ((((to - from) % 24) + 36) % 24) - 12

/** turns the room's clock to an hour (null: Raipur's own time) over a moment, the short way round, so the light
 * sweeps across the room instead of jumping */
export function glideTime(to: number | null, ms = 1100) {
  cancelAnimationFrame(glide)
  if (to === null && useOutside.getState().pick.hour === null) return // already on Raipur's time
  const from = useOutside.getState().hour
  const d = hoursBetween(from, to ?? useOutside.getState().real.hour)
  const t0 = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms)
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
    const pick = useOutside.getState().pick
    if (k < 1) {
      update({ pick: { ...pick, hour: (((from + d * e) % 24) + 24) % 24 } })
      glide = requestAnimationFrame(step)
    } else update({ pick: { ...pick, hour: to } })
  }
  glide = requestAnimationFrame(step)
}

/** back to Raipur's own time and weather */
export function backToNow() {
  pickTime({ sky: null })
  glideTime(null)
}

/* ---------- words for the overlay chip ---------- */

export function clockText(hour: number) {
  const h = Math.floor(hour)
  const m = Math.floor((hour - h) * 60)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

export function skyText(sky: Sky, day: number, golden: number, hour: number) {
  const clear =
    golden > 0.5 ? (hour < 12 ? t('sunrise', 'सूर्योदय') : t('sunset', 'सूर्यास्त')) : day < 0.3 ? t('clear night', 'साफ़ रात') : t('sunny', 'धूप')
  return {
    clear,
    cloudy: t('cloudy', 'बादल'),
    fog: t('hazy', 'धुंध'),
    rain: t('raining', 'बारिश'),
    storm: t('thunderstorm', 'आँधी-तूफ़ान'),
  }[sky]
}

/** What Sameer is probably up to right now, by Raipur time. */
export function doing(hour: number, weekday: number) {
  const weekend = weekday === 0 || weekday === 6
  if (hour < 4) return t('Sameer is probably still debugging something.', 'Sameer शायद अब भी कुछ debug कर रहा है।')
  if (hour < 7) return t('Sameer is asleep. Probably.', 'Sameer सो रहा है। शायद।')
  if (hour < 9) return t('Sameer is probably making chai.', 'Sameer शायद चाय बना रहा है।')
  if (hour < 17)
    return weekend
      ? t('Sameer is probably in a Codeforces round.', 'Sameer शायद Codeforces राउंड में है।')
      : t('Sameer is probably in class at IIIT.', 'Sameer शायद IIIT में क्लास में है।')
  if (hour < 20) return t('Sameer is probably at this desk right now.', 'Sameer शायद अभी इसी डेस्क पर है।')
  return t('Sameer is probably training a model.', 'Sameer शायद कोई मॉडल ट्रेन कर रहा है।')
}
