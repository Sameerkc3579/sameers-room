// One AudioContext for the whole OS. Everything routes into `master`, which the mute toggle controls.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

export function audio() {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return { ctx, master: master! }
}

export function setMuted(m: boolean) {
  muted = m
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05)
}

let noise: AudioBuffer | null = null
export function noiseBuffer(c: AudioContext) {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12)
