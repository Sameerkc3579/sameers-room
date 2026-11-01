// Procedural lo-fi: Rhodes-ish chords, sine bass, soft drums, a wandering pentatonic melody and vinyl crackle,
// all synthesised with Web Audio, so there are no audio files or licences involved.
import { audio, midiHz, noiseBuffer } from './ctx'

interface Track {
  title: string
  bpm: number
  chords: number[][] // one chord per bar, MIDI notes
  bass: number[] // root per bar
  scale: number[] // melody notes
  kick: string
  snare: string
  hat: string
  swing: number
  seed: number
}

export const TRACKS: Track[] = [
  {
    title: 'golden hour',
    bpm: 74,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    bass: [41, 40, 38, 36],
    scale: [72, 74, 76, 79, 81, 84],
    kick: 'x.....x...x.....',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    swing: 0.18,
    seed: 11,
  },
  {
    title: 'window seat',
    bpm: 80,
    chords: [[57, 60, 64, 67], [50, 54, 57, 60, 64], [55, 59, 62, 66], [48, 52, 55, 59]],
    bass: [45, 38, 43, 36],
    scale: [69, 72, 74, 76, 79, 81],
    kick: 'x.......x.x.....',
    snare: '....x.......x..x',
    hat: 'x.xxx.x.x.xxx.x.',
    swing: 0.14,
    seed: 23,
  },
  {
    title: 'late commit',
    bpm: 70,
    chords: [[51, 55, 58, 62], [48, 51, 55, 58], [53, 56, 60, 63], [46, 50, 53, 56]],
    bass: [39, 36, 41, 34],
    scale: [75, 77, 79, 82, 84, 87],
    kick: 'x......x..x.....',
    snare: '....x.......x...',
    hat: 'x...x...x...x...',
    swing: 0.2,
    seed: 37,
  },
  {
    title: 'monsoon tabs',
    bpm: 68,
    chords: [[50, 53, 57, 60], [46, 50, 53, 57], [55, 58, 62, 65], [57, 61, 64, 67]],
    bass: [38, 34, 43, 45],
    scale: [74, 77, 79, 81, 84, 86],
    kick: 'x.....x.x.......',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.xx',
    swing: 0.16,
    seed: 53,
  },
]

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Listener = () => void

class Lofi {
  index = 0
  playing = false
  volume = 0.7
  startedAt = 0
  analyser: AnalyserNode | null = null

  private bus: GainNode | null = null
  private keysBus: GainNode | null = null
  private wobble: GainNode | null = null
  private vinyl: AudioBufferSourceNode | null = null
  private timer = 0
  private step = 0
  private nextTime = 0
  private listeners = new Set<Listener>()
  private version = 0

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }
  snapshot = () => this.version
  private emit() {
    this.version++
    this.listeners.forEach((l) => l())
  }

  get track() {
    return TRACKS[this.index]
  }

  private build() {
    if (this.bus) return
    const { ctx, master } = audio()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3200
    const comp = ctx.createDynamicsCompressor()
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 64
    this.bus = ctx.createGain()
    this.bus.gain.value = this.volume
    this.bus.connect(lp).connect(comp).connect(this.analyser).connect(master)

    // keys get a slow tremolo
    this.keysBus = ctx.createGain()
    const trem = ctx.createOscillator()
    const tremDepth = ctx.createGain()
    trem.frequency.value = 4.2
    tremDepth.gain.value = 0.12
    trem.connect(tremDepth).connect(this.keysBus.gain)
    trem.start()
    this.keysBus.connect(this.bus)

    // tape wobble: a slow LFO in cents, patched into every pitched oscillator's detune
    const wob = ctx.createOscillator()
    wob.frequency.value = 0.45
    this.wobble = ctx.createGain()
    this.wobble.gain.value = 9
    wob.connect(this.wobble)
    wob.start()
  }

  private startVinyl() {
    const { ctx } = audio()
    const len = ctx.sampleRate * 3
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      let v = (Math.random() * 2 - 1) * 0.06
      if (Math.random() < 0.0004) v += (Math.random() * 2 - 1) * 0.9 // crackle pops
      d[i] = v
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2500
    bp.Q.value = 0.5
    const g = ctx.createGain()
    g.gain.value = 0.22
    src.connect(bp).connect(g).connect(this.bus!)
    src.start()
    this.vinyl = src
  }

  private osc(type: OscillatorType, midi: number, t: number, end: number, out: AudioNode) {
    const { ctx } = audio()
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = midiHz(midi)
    this.wobble!.connect(o.detune)
    o.connect(out)
    o.start(t)
    o.stop(end)
    o.onended = () => this.wobble?.disconnect(o.detune)
  }

  private env(t: number, peak: number, attack: number, len: number) {
    const { ctx } = audio()
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    return g
  }

  private keys(note: number, t: number, len: number, vel: number) {
    const g = this.env(t, 0.07 * vel, 0.015, len)
    g.connect(this.keysBus!)
    this.osc('sine', note, t, t + len + 0.05, g)
    const h = audio().ctx.createGain()
    h.gain.value = 0.25
    h.connect(g)
    this.osc('triangle', note + 12, t, t + len + 0.05, h)
  }

  private bass(note: number, t: number, len: number) {
    const g = this.env(t, 0.22, 0.03, len)
    g.connect(this.bus!)
    this.osc('sine', note, t, t + len + 0.05, g)
  }

  private lead(note: number, t: number, len: number) {
    const { ctx } = audio()
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 1800
    const g = this.env(t, 0.05, 0.02, len)
    f.connect(g).connect(this.bus!)
    this.osc('triangle', note, t, t + len + 0.05, f)
  }

  private kick(t: number) {
    const { ctx } = audio()
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
    const g = this.env(t, 0.55, 0.004, 0.38)
    o.connect(g).connect(this.bus!)
    o.start(t)
    o.stop(t + 0.4)
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, vol: number, len: number) {
    const { ctx } = audio()
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx)
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = this.env(t, vol, 0.002, len)
    src.connect(f).connect(g).connect(this.bus!)
    src.start(t, Math.random() * 1.5)
    src.stop(t + len + 0.02)
  }

  private schedule(step: number, t: number) {
    const tr = this.track
    const s = step % 16
    const bar = Math.floor(step / 16)
    const ci = bar % tr.chords.length
    const beat = 60 / tr.bpm
    const r = rng(tr.seed * 1000 + (bar % 8))
    for (let i = 0; i < s; i++) r() // advance so every step draws different numbers

    if (s === 0) tr.chords[ci].forEach((n, i) => this.keys(n, t + i * 0.018, beat * 3.6, 1))
    if (s === 10 && r() < 0.6) tr.chords[ci].forEach((n, i) => this.keys(n, t + i * 0.012, beat * 1.2, 0.55))
    if (s === 0) this.bass(tr.bass[ci], t, beat * 2.2)
    if (s === 10) this.bass(tr.bass[ci] + (r() < 0.5 ? 7 : 12), t, beat * 1.2)

    if (tr.kick[s] === 'x') this.kick(t)
    if (tr.snare[s] === 'x') this.noiseHit(t, 'bandpass', 1700, 0.18, 0.18)
    if (tr.hat[s] === 'x') this.noiseHit(t, 'highpass', 7500, 0.03 + r() * 0.03, 0.05)

    // melody rests every other phrase so it doesn't get tiring
    if (bar % 8 >= 4 && [0, 3, 6, 8, 11, 14].includes(s) && r() < 0.55) {
      const n = tr.scale[Math.floor(r() * tr.scale.length)]
      this.lead(n, t, beat * (r() < 0.3 ? 1.5 : 0.7))
    }
  }

  private tick = () => {
    const { ctx } = audio()
    const tr = this.track
    const sixteenth = 60 / tr.bpm / 4
    while (this.nextTime < ctx.currentTime + 0.15) {
      const swing = this.step % 2 ? tr.swing * sixteenth : 0
      this.schedule(this.step, this.nextTime + swing)
      this.nextTime += sixteenth
      this.step++
    }
  }

  play() {
    if (this.playing) return
    this.build()
    const { ctx } = audio()
    this.playing = true
    this.step = 0
    this.nextTime = ctx.currentTime + 0.08
    this.startedAt = ctx.currentTime
    this.startVinyl()
    this.timer = window.setInterval(this.tick, 25)
    this.emit()
  }

  pause() {
    if (!this.playing) return
    this.playing = false
    clearInterval(this.timer)
    this.vinyl?.stop()
    this.vinyl = null
    this.emit()
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  go(i: number) {
    const was = this.playing
    this.pause()
    this.index = (i + TRACKS.length) % TRACKS.length
    if (was) this.play()
    else this.emit()
  }
  next = () => this.go(this.index + 1)
  prev = () => this.go(this.index - 1)

  setVolume(v: number) {
    this.volume = v
    if (this.bus) this.bus.gain.setTargetAtTime(v, audio().ctx.currentTime, 0.05)
    this.emit()
  }

  elapsed() {
    return this.playing ? audio().ctx.currentTime - this.startedAt : 0
  }
}

export const lofi = new Lofi()
