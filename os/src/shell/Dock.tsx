import { useOS } from '../store'
import { APPS, type AppId } from '../apps/meta'
import { Icon } from './icons'
import { clockText, dateText, useNow } from './time'

/** Pinned apps, in dock order. Other open windows (project pages, Recycle Bin…) appear after a divider. */
const PINNED: AppId[] = ['projects', 'computer', 'resume', 'terminal', 'agent', 'contact', 'music']

export function Dock() {
  const windows = useOS((s) => s.windows)
  const activeId = useOS((s) => s.activeId)
  const startOpen = useOS((s) => s.startOpen)
  const sound = useOS((s) => s.sound)
  const { setStartOpen, focus, minimize, open, setSound } = useOS.getState()
  const now = useNow()

  const click = (app: AppId, id?: string) => {
    const w = id ? windows.find((x) => x.id === id) : undefined
    if (!w) return open(app)
    if (activeId === w.id && !w.min) minimize(w.id)
    else focus(w.id)
  }
  const extras = windows.filter((w) => !PINNED.includes(w.app) && w.app !== 'message')

  return (
    <>
      <nav className="dock" aria-label="Dock">
        <button
          className={`dock-btn launcher-btn${startOpen ? ' on' : ''}`}
          aria-label="Start"
          title="Start"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setStartOpen(!startOpen)}
        >
          <Icon name="logo" size={34} />
        </button>
        <span className="dock-sep" />
        {PINNED.map((app) => {
          const w = windows.find((x) => x.app === app)
          return (
            <button
              key={app}
              className={`dock-btn${w ? ' running' : ''}${w && activeId === w.id && !w.min ? ' active' : ''}`}
              title={APPS[app].title}
              aria-label={APPS[app].title}
              onClick={() => click(app, w?.id)}
            >
              <Icon name={APPS[app].icon} size={34} />
            </button>
          )
        })}
        {extras.length > 0 && <span className="dock-sep" />}
        {extras.map((w) => (
          <button
            key={w.id}
            className={`dock-btn running${activeId === w.id && !w.min ? ' active' : ''}`}
            title={w.title}
            aria-label={w.title}
            onClick={() => click(w.app, w.id)}
          >
            <Icon name={w.icon} size={34} />
          </button>
        ))}
      </nav>
      <div className="tray">
        <button className="tray-btn" title={sound ? 'Mute' : 'Unmute'} onClick={() => setSound(!sound)}>
          <Icon name={sound ? 'speaker' : 'mute'} size={18} />
        </button>
        <div className="tray-time">
          <span>{clockText(now)}</span>
          <small>{dateText(now).split(', ').slice(1).join(', ')}</small>
        </div>
      </div>
    </>
  )
}
