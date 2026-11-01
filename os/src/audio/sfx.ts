import { audio, midiHz } from './ctx'

function bell(notes: number[], gap: number, len: number, vol = 0.18) {
  const { ctx, master } = audio()
  const t0 = ctx.currentTime + 0.05
  notes.forEach((n, i) => {
    const t = t0 + i * gap
    const o = ctx.createOscillator()
    const o2 = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o2.type = 'triangle'
    o.frequency.value = midiHz(n)
    o2.frequency.value = midiHz(n + 12)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    const g2 = ctx.createGain()
    g2.gain.value = 0.2
    o.connect(g)
    o2.connect(g2).connect(g)
    g.connect(master)
    o.start(t)
    o2.start(t)
    o.stop(t + len + 0.1)
    o2.stop(t + len + 0.1)
  })
}

/** Soft rising pad played on login. Original, not the XP chime. */
export const chime = () => bell([63, 70, 75, 79, 82], 0.16, 2.4, 0.12)
export const ding = () => bell([76, 72], 0.09, 0.5, 0.14)
export const goodbye = () => bell([82, 79, 75, 70], 0.18, 1.6, 0.1)
