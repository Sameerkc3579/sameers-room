// The room is in Raipur: the light through the window follows Raipur's clock and its live weather (Open-Meteo,
// no key needed). Lights.tsx and Rain.tsx read this; the overlay shows it as a little chip.
// Preview any moment with URL params, e.g.  ?raipur=19:10&sky=storm   (sky: clear | cloudy | fog | rain | storm)
import { create } from 'zustand'
import { t } from './i18n'

export type Sky = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm'

interface Outside {
  /** Raipur local time in hours (14.5 = 2:30 pm) and its weekday (0 = Sunday) */
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

export const useOutside = create<Outside>(() => {
  const { hour, weekday } = raipurNow()
  // typical Raipur sun times until the forecast arrives
  return { hour, weekday, sunrise: 6.1, sunset: 17.6, sky: forcedSky ?? 'clear', temp: null, ...light(hour, 6.1, 17.6) }
})

function tick() {
  const { hour, weekday } = raipurNow()
  const { sunrise, sunset } = useOutside.getState()
  useOutside.setState({ hour, weekday, ...light(hour, sunrise, sunset) })
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
  useOutside.setState({
    sunrise,
    sunset,
    sky: forcedSky ?? skyOf(Number(d.current?.weather_code ?? 0)),
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
