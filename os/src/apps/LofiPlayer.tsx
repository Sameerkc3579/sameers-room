import { useEffect, useRef, useSyncExternalStore } from 'react'
import { lofi, TRACKS } from '../audio/lofi'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const ART = `${import.meta.env.BASE_URL}wallpaper.jpg`

export function LofiPlayer() {
  useSyncExternalStore(lofi.subscribe, lofi.snapshot)
  const canvas = useRef<HTMLCanvasElement>(null)
  const time = useRef<HTMLSpanElement>(null)

  // visualiser + elapsed time, drawn straight to the DOM every frame
  useEffect(() => {
    let raf = 0
    const data = new Uint8Array(32)
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (time.current) time.current.textContent = fmt(lofi.elapsed())
      const c = canvas.current
      if (!c) return
      const g = c.getContext('2d')!
      g.clearRect(0, 0, c.width, c.height)
      if (lofi.playing && lofi.analyser) lofi.analyser.getByteFrequencyData(data)
      else data.fill(0)
      const bars = 24
      const bw = c.width / bars
      g.fillStyle = 'rgba(255,255,255,.85)'
      for (let i = 0; i < bars; i++) {
        const v = data[(i % 30) + 1] / 255
        const h = Math.max(2, v * c.height)
        g.beginPath()
        g.roundRect(i * bw + 1.5, c.height - h, bw - 3, h, 2)
        g.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  const t = lofi.track
  return (
    <div className="window-body flush player">
      <div className="pl-art" style={{ backgroundImage: `url(${ART})` }}>
        <canvas ref={canvas} width={260} height={60} />
      </div>
      <div className="pl-info">
        <b>{t.title}</b>
        <small>
          sameer's room · {t.bpm} bpm · <span ref={time}>0:00</span>
        </small>
      </div>
      <div className="pl-controls">
        <button className="round" aria-label="Previous" onClick={lofi.prev}>
          ⏮
        </button>
        <button className="round big primary" aria-label={lofi.playing ? 'Pause' : 'Play'} onClick={() => lofi.toggle()}>
          {lofi.playing ? '❚❚' : '▶'}
        </button>
        <button className="round" aria-label="Next" onClick={lofi.next}>
          ⏭
        </button>
      </div>
      <label className="pl-volume">
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={lofi.volume}
          onChange={(e) => lofi.setVolume(Number(e.target.value))}
        />
      </label>
      <ol className="pl-list">
        {TRACKS.map((tr, i) => (
          <li key={tr.title}>
            <button
              className={i === lofi.index ? 'current' : ''}
              onClick={() => {
                lofi.go(i)
                if (!lofi.playing) lofi.play()
              }}
            >
              <span>{tr.title}</span>
              <small>{i === lofi.index && lofi.playing ? 'playing' : `${tr.bpm} bpm`}</small>
            </button>
          </li>
        ))}
      </ol>
      <p className="pl-note">Generated live in your browser. No recordings.</p>
    </div>
  )
}
