import { useEffect } from 'react'
import { useOS } from '../store'
import { embedded, send } from '../bridge'
import { goodbye } from '../audio/sfx'
import { lofi } from '../audio/lofi'
import { Icon, type IconName } from './icons'

export function PowerMenu() {
  const { setTurnOffOpen, setPhase, closeAll } = useOS.getState()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTurnOffOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTurnOffOpen])

  // In the 3D room, leaving hands control back to the scene, which zooms the camera out.
  const leave = (reset: boolean) => {
    goodbye()
    if (reset) {
      lofi.pause()
      closeAll()
    }
    if (embedded) {
      send({ type: 'os:shutdown' })
      setTurnOffOpen(false)
      if (reset) setPhase('login')
    } else {
      setPhase(reset ? 'off' : 'login')
    }
  }

  const options: { icon: IconName; label: string; run: () => void }[] = [
    { icon: 'standby', label: embedded ? 'Back to room' : 'Sleep', run: () => leave(false) },
    {
      icon: 'logoff',
      label: 'Sign out',
      run: () => {
        closeAll()
        setPhase('login')
      },
    },
    {
      icon: 'restart',
      label: 'Restart',
      run: () => {
        closeAll()
        setPhase('boot')
      },
    },
    { icon: 'power', label: 'Shut down', run: () => leave(true) },
  ]

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setTurnOffOpen(false)}>
      <div className="power-menu" role="dialog" aria-label="Power">
        <h2>Power</h2>
        <div className="power-options">
          {options.map((o) => (
            <button key={o.label} onClick={o.run}>
              <Icon name={o.icon} size={36} />
              <span>{o.label}</span>
            </button>
          ))}
        </div>
        <button className="cancel" onClick={() => setTurnOffOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
