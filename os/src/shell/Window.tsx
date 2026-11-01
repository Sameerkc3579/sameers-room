import { Rnd } from 'react-rnd'
import { useOS, type Win } from '../store'
import { APPS } from '../apps/meta'
import { APP_COMPONENTS } from '../apps'
import { Icon } from './icons'

export function Window({ win }: { win: Win }) {
  const active = useOS((s) => s.activeId === win.id)
  const { focus, close, minimize, toggleMax, setRect } = useOS.getState()
  const meta = APPS[win.app]
  const Body = APP_COMPONENTS[win.app]
  const resizable = meta.resizable !== false

  return (
    <Rnd
      className={`win${active ? '' : ' inactive'}${win.max ? ' maxed' : ''}`}
      style={{ zIndex: win.z, display: win.min ? 'none' : 'flex' }}
      size={win.max ? { width: '100%', height: '100%' } : { width: win.w, height: win.h }}
      position={win.max ? { x: 0, y: 0 } : { x: win.x, y: win.y }}
      bounds="parent"
      dragHandleClassName="title-bar"
      cancel=".title-bar-controls"
      disableDragging={win.max}
      enableResizing={resizable && !win.max}
      minWidth={280}
      minHeight={160}
      onDragStart={() => focus(win.id)}
      onDragStop={(_, d) => setRect(win.id, { x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, pos) =>
        setRect(win.id, { w: ref.offsetWidth, h: ref.offsetHeight, x: pos.x, y: pos.y })
      }
    >
      <div className="win-inner" onPointerDownCapture={() => focus(win.id)}>
        <div className="title-bar" onDoubleClick={() => resizable && toggleMax(win.id)}>
          <div className="title-bar-text">
            <Icon name={win.icon} size={16} />
            <span>{win.title}</span>
          </div>
          <div className="title-bar-controls">
            {win.app !== 'message' && (
              <button aria-label="Minimize" onClick={() => minimize(win.id)}>
                <svg viewBox="0 0 10 10">
                  <path d="M1 5h8" />
                </svg>
              </button>
            )}
            {resizable && (
              <button aria-label={win.max ? 'Restore' : 'Maximize'} onClick={() => toggleMax(win.id)}>
                <svg viewBox="0 0 10 10">
                  {win.max ? <path d="M3 1h6v6M1 3h6v6H1z" /> : <rect x="1" y="1" width="8" height="8" rx="1.2" />}
                </svg>
              </button>
            )}
            <button aria-label="Close" className="close" onClick={() => close(win.id)}>
              <svg viewBox="0 0 10 10">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <Body win={win} />
      </div>
    </Rnd>
  )
}
