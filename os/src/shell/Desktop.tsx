import { useEffect, useState } from 'react'
import { useOS } from '../store'
import type { AppId } from '../apps/meta'
import { Icon, type IconName } from './icons'
import { Window } from './Window'
import { Dock } from './Dock'
import { Launcher } from './Launcher'
import { PowerMenu } from './PowerMenu'
import { BigClock } from './Clock'

const ICONS: { app: AppId; label: string; icon: IconName }[] = [
  { app: 'computer', label: 'About me', icon: 'computer' },
  { app: 'projects', label: 'Projects', icon: 'folder-docs' },
  { app: 'resume', label: 'Resume.pdf', icon: 'pdf' },
  { app: 'terminal', label: 'Terminal', icon: 'cmd' },
  { app: 'contact', label: 'Contact', icon: 'mail' },
  { app: 'music', label: 'Lo-fi', icon: 'music' },
  { app: 'agent', label: 'Break my agent', icon: 'shield' },
  { app: 'guard', label: 'Injection detector', icon: 'scan' },
  { app: 'recycle', label: 'Recycle Bin', icon: 'recycle-full' },
]

const coarse = () => window.matchMedia('(pointer: coarse)').matches
export const WALLPAPER = `${import.meta.env.BASE_URL}wallpaper.jpg`

function Toast() {
  const show = useOS((s) => s.balloon)
  const { setBalloon, open } = useOS.getState()
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setBalloon(false), 12_000)
    return () => clearTimeout(t)
  }, [show, setBalloon])
  if (!show) return null
  const go = (app: AppId) => (e: React.MouseEvent) => {
    e.preventDefault()
    setBalloon(false)
    open(app)
  }
  return (
    <div className="toast" role="status">
      <Icon name="logo" size={28} />
      <div>
        <b>Welcome to SameerOS</b>
        <p>
          Open{' '}
          <a href="#" onClick={go('projects')}>
            Projects
          </a>{' '}
          to see what I've built, or{' '}
          <a href="#" onClick={go('computer')}>
            About me
          </a>
          .
        </p>
      </div>
      <button className="toast-x" aria-label="Dismiss" onClick={() => setBalloon(false)}>
        ×
      </button>
    </div>
  )
}

export function Desktop() {
  const windows = useOS((s) => s.windows)
  const turnOffOpen = useOS((s) => s.turnOffOpen)
  const open = useOS((s) => s.open)
  const [selected, setSelected] = useState<AppId | null>(null)

  useEffect(() => {
    const t = setTimeout(() => useOS.getState().setBalloon(true), 1400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`desktop${turnOffOpen ? ' dimmed' : ''}`} style={{ backgroundImage: `url(${WALLPAPER})` }}>
      <div className="desk-area" onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}>
        <div className="desk-icons">
          {ICONS.map((it) => (
            <div
              key={it.app}
              role="button"
              tabIndex={0}
              className={`desk-icon${selected === it.app ? ' selected' : ''}`}
              onClick={() => (coarse() ? open(it.app) : setSelected(it.app))}
              onDoubleClick={() => open(it.app)}
              onKeyDown={(e) => e.key === 'Enter' && open(it.app)}
              onFocus={() => setSelected(it.app)}
            >
              <Icon name={it.icon} size={40} />
              <span>{it.label}</span>
            </div>
          ))}
        </div>
        <BigClock />
        <div className="win-layer">
          {windows.map((w) => (
            <Window key={w.id} win={w} />
          ))}
        </div>
      </div>
      <Toast />
      <Launcher />
      <Dock />
      {turnOffOpen && <PowerMenu />}
    </div>
  )
}
