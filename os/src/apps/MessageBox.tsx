import { useEffect } from 'react'
import { useOS, type Win } from '../store'
import { ding } from '../audio/sfx'
import { Icon } from '../shell/icons'

export function MessageBox({ win }: { win: Win }) {
  const close = useOS((s) => s.close)
  const kind = (win.props.kind as 'info' | 'warning' | 'error') ?? 'info'
  useEffect(() => {
    if (useOS.getState().sound) ding()
  }, [])
  return (
    <div className="window-body msgbox">
      <div className="mb-row">
        <Icon name={kind} size={32} />
        <p>{String(win.props.text)}</p>
      </div>
      <div className="mb-actions">
        <button className="primary" autoFocus onClick={() => close(win.id)}>
          OK
        </button>
      </div>
    </div>
  )
}
