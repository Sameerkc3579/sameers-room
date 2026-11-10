// Room sounds, all made in code with the Web Audio API (no audio files to download):
//   outside   rain on the window when it's raining in Raipur (thunder in a storm, Lights.tsx), birds by day and
//             crickets at night (raipur.ts)
//   inside    a crackle from the candles now and then
//   things    the lamp's switch and the blinds, a book opening, closing and turning a page, keys when you sit down
//             at the computer, and the room coming apart and each piece landing as it builds itself (build.ts)
// Browsers only allow sound after the visitor's first click, tap or key, so it starts then, fading in. The dock's
// speaker button turns it all off (SameerOS and its lo-fi too) and the choice is remembered.
import { create } from 'zustand'
import { useScene } from './store'
import { useOutside } from './raipur'
import { sendOS } from './osLink'

const KEY = 'room-sound'
function saved() {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export const useSound = create<{ on: boolean }>(() => ({ on: saved() }))

export function toggleSound() {
  const on = !useSound.getState().on
  useSound.setState({ on })
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}

/* ---------- the engine ---------- */

let ctx: AudioContext | null = null
let master: GainNode
/** the ambience: quieter while a book is open or you're at the computer, and under the lo-fi */
let bed: GainNode
/** the birds and crickets are outside, through the glass */
let outside: BiquadFilterNode
let rain: GainNode
/** one-off sounds */
let fx: GainNode
let noise: AudioBuffer

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const live = () => !!ctx && ctx.state === 'running' && useSound.getState().on

function boot() {
  if (ctx) {
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume()
    return
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  bed = ctx.createGain()
  bed.connect(master)
  fx = ctx.createGain()
  fx.connect(master)
  outside = ctx.createBiquadFilter()
  outside.type = 'lowpass'
  outside.frequency.value = 5200
  outside.connect(bed)

  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

  // rain: a steady wash of filtered noise (its drops on the glass are scheduled in tick())
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 250
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1500
  rain = ctx.createGain()
  rain.gain.value = 0
  src.connect(hp).connect(lp).connect(rain).connect(bed)
  src.start()

  level()
  setInterval(tick, 100)
}
for (const e of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(e, boot, { capture: true, passive: true })

// a hidden tab makes no sound and costs nothing
document.addEventListener('visibilitychange', () => {
  if (!ctx) return
  if (document.hidden) void ctx.suspend()
  else void ctx.resume()
})

/** how loud everything is: the switch, where you are, and whether the lo-fi is playing */
function level() {
  if (!ctx) return
  const s = useScene.getState()
  const now = ctx.currentTime
  const on = useSound.getState().on
  master.gain.setTargetAtTime(on ? 1.1 : 0, now, on ? 0.6 : 0.06) // fades in, but goes quiet at once
  const where = s.view === 'room' ? 1 : s.view === 'focus' ? 0.55 : 0.3
  bed.gain.setTargetAtTime(where * (s.music.playing ? 0.55 : 1), now, 0.4)
}
useScene.subscribe(level)
useSound.subscribe(level)

// SameerOS has its own sounds and the lo-fi: one switch for both
useSound.subscribe((s, prev) => s.on !== prev.on && sendOS({ type: 'os:sound', on: s.on }))
if (!useSound.getState().on) sendOS({ type: 'os:sound', on: false }) // (queued until the OS is there)
addEventListener('message', (e) => {
  // the OS iframe can be started again (after shutting it down): tell it each time
  if (e.origin === location.origin && e.data?.type === 'os:hello') sendOS({ type: 'os:sound', on: useSound.getState().on })
})

/* ---------- building blocks ---------- */

interface Burst {
  dur: number
  /** filter frequency, sweeping to `to` if given */
  freq: number
  to?: number
  type?: BiquadFilterType
  q?: number
  gain: number
  attack?: number
  out?: AudioNode
}

/** a puff of filtered noise: drops, crackles, clicks, swishes, rumbles */
function burst(t: number, { dur, freq, to, type = 'bandpass', q = 1, gain, attack = 0.004, out = fx }: Burst) {
  const c = ctx!
  const src = c.createBufferSource()
  src.buffer = noise
  const f = c.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random() * 1.5)
  src.stop(t + dur + 0.05)
}

interface Tone {
  dur: number
  f: number
  to?: number
  gain: number
  attack?: number
  type?: OscillatorType
  out?: AudioNode
}

/** a short pitched sound: chirps, knocks, thumps */
function tone(t: number, { dur, f, to, gain, attack = 0.005, type = 'sine', out = fx }: Tone) {
  const c = ctx!
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/* ---------- the ambience, scheduled a little ahead every 100 ms ---------- */

const next = { drop: 0, crackle: 0, bird: 0, crickets: [0, 0] }

function tick() {
  if (!live()) return
  const c = ctx!
  const now = c.currentTime
  const ahead = now + 0.2
  const o = useOutside.getState()
  const wet = o.sky === 'rain' ? 1 : o.sky === 'storm' ? 1.5 : 0
  rain.gain.setTargetAtTime(0.11 * wet, now, 1.5)

  // drops hitting the window
  if (wet)
    while (next.drop < ahead) {
      if (next.drop >= now) burst(next.drop, { dur: rand(0.01, 0.03), freq: rand(1800, 5000), q: 3, gain: rand(0.015, 0.05) * wet, attack: 0.001, out: bed })
      next.drop = Math.max(next.drop, now) + rand(0.015, 0.12) / wet
    }

  // the candles
  while (next.crackle < ahead) {
    if (next.crackle >= now) {
      const t = next.crackle
      burst(t, { dur: rand(0.006, 0.016), freq: rand(1500, 3800), q: 2, gain: rand(0.02, 0.05), attack: 0.001, out: bed })
      if (Math.random() < 0.35) burst(t + rand(0.02, 0.06), { dur: 0.008, freq: rand(2000, 4000), q: 2, gain: 0.02, attack: 0.001, out: bed })
    }
    next.crackle = Math.max(next.crackle, now) + rand(0.5, 4.5)
  }

  // birds in the garden by day (not in the rain)
  if (o.day > 0.45 && !wet && next.bird < ahead) {
    if (next.bird >= now) song(next.bird)
    next.bird = Math.max(next.bird, now) + rand(3, 11)
  }

  // crickets at night: two of them, a little out of step
  if (o.day < 0.25 && !wet)
    next.crickets.forEach((t, i) => {
      if (t >= ahead) return
      if (t >= now) cricket(t, i)
      next.crickets[i] = Math.max(t, now) + rand(0.8, 1.15) * (i ? 1.17 : 1)
    })
}

/** a bird: a few quick whistles, each sliding up or down */
function song(t: number) {
  const base = rand(2600, 4200)
  const n = 2 + Math.floor(Math.random() * 4)
  const up = Math.random() < 0.5
  for (let i = 0; i < n; i++) {
    const f = base * rand(0.9, 1.12)
    const dur = rand(0.06, 0.13)
    tone(t, { dur, f, to: f * (up ? rand(1.15, 1.4) : rand(0.7, 0.85)), gain: rand(0.03, 0.055), attack: 0.012, out: outside })
    t += dur + rand(0.04, 0.12)
  }
}

/** a cricket: three or four very short pulses of one high note */
function cricket(t: number, i: number) {
  const f = 4300 + i * 380
  const n = 3 + (Math.random() < 0.5 ? 1 : 0)
  for (let k = 0; k < n; k++) tone(t + k * 0.042, { dur: 0.024, f, gain: 0.014, attack: 0.004, out: outside })
}

/* ---------- things that happen ---------- */

/** thunder rolling in a moment after the lightning (Lights.tsx) */
export function thunder() {
  if (!live()) return
  const t = ctx!.currentTime + rand(0.5, 2)
  burst(t, { dur: rand(2.5, 4.2), freq: 180, to: 55, type: 'lowpass', q: 0.7, gain: 0.55, attack: rand(0.08, 0.3), out: bed })
  burst(t, { dur: 0.7, freq: 900, to: 180, q: 0.6, gain: 0.07, attack: 0.02, out: bed })
}

/** the lamp's switch, then the blinds coming down (lights off) or going back up */
useScene.subscribe((s, prev) => {
  if (s.lightsOn === prev.lightsOn || !live()) return
  const t = ctx!.currentTime + 0.02
  burst(t, { dur: 0.012, freq: 3200, q: 1.5, gain: 0.16, attack: 0.001 })
  tone(t, { dur: 0.04, f: 160, to: 80, gain: 0.08, attack: 0.002 })
  // slats rattling down (or up) the cord: the gaps between them shrink as it speeds up
  let at = t + 0.18
  for (let i = 0; i < 14; i++) {
    burst(at, { dur: 0.018, freq: rand(2200, 3600), q: 4, gain: rand(0.025, 0.05), attack: 0.001 })
    at += s.lightsOn ? 0.03 + i * 0.004 : 0.085 - i * 0.004
  }
  burst(t + 0.18, { dur: at - t - 0.1, freq: 1400, q: 0.6, gain: 0.02, attack: 0.1 })
})

/** keys under your fingers as you sit down at the computer */
useScene.subscribe((s, prev) => {
  if (!(s.view === 'screen' && s.arrived && !prev.arrived) || !live()) return
  let t = ctx!.currentTime + 0.05
  for (let i = 0; i < 7; i++) {
    burst(t, { dur: 0.022, freq: rand(2600, 4200), q: 2, gain: rand(0.04, 0.07), attack: 0.001 })
    tone(t, { dur: 0.03, f: rand(170, 240), to: 90, gain: 0.04, attack: 0.002 })
    t += rand(0.07, 0.17)
  }
})

/** paper: a book's cover swinging open, or a page turning */
export function page() {
  if (!live()) return
  burst(ctx!.currentTime + 0.01, { dur: rand(0.26, 0.34), freq: 650, to: rand(2600, 3400), q: 0.9, gain: 0.09, attack: 0.05 })
}

/** a book shutting */
export function shut() {
  if (!live()) return
  const t = ctx!.currentTime + 0.12 // as the cover lands
  tone(t, { dur: 0.16, f: 120, to: 55, gain: 0.16, attack: 0.003 })
  burst(t, { dur: 0.09, freq: 600, type: 'lowpass', gain: 0.07, attack: 0.002 })
}

/** the room coming apart for the replay (build.ts) */
export function whoosh() {
  if (!live()) return
  burst(ctx!.currentTime + 0.02, { dur: 1.1, freq: 2400, to: 220, q: 0.6, gain: 0.08, attack: 0.3 })
}

let landed = 0
/** a piece of the room arriving as it builds itself (BuildRig.tsx): walls and floor with a low thud, furniture with
 * a knock, small things with a pop */
export function land(how: 'grow' | 'rise' | 'drop' | 'pop') {
  if (!live()) return
  const t = ctx!.currentTime
  if (t - landed < 0.045) return // a whole shelf of things landing at once is one sound, not twenty
  landed = t
  if (how === 'grow' || how === 'rise') {
    tone(t, { dur: 0.5, f: 75, to: 40, gain: 0.2, attack: 0.01 })
    burst(t, { dur: 0.3, freq: 300, type: 'lowpass', gain: 0.06, attack: 0.01 })
  } else if (how === 'drop') {
    tone(t, { dur: 0.09, f: rand(150, 230), to: 80, gain: 0.1, attack: 0.002 })
    burst(t, { dur: 0.02, freq: rand(1500, 2400), q: 1.5, gain: 0.03, attack: 0.001 })
  } else {
    const f = rand(520, 820)
    tone(t, { dur: 0.06, f, to: f * 1.5, gain: 0.035, attack: 0.004 })
  }
}
