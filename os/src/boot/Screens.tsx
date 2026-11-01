import { useEffect } from 'react'
import { useOS } from '../store'
import { profile } from '../content/profile'
import { embedded, send } from '../bridge'
import { chime } from '../audio/sfx'
import { Icon } from '../shell/icons'
import { BigClock } from '../shell/Clock'
import { WALLPAPER } from '../shell/Desktop'

export function Boot() {
  const setPhase = useOS((s) => s.setPhase)
  useEffect(() => {
    const t = setTimeout(() => setPhase('login'), 2800)
    const skip = () => setPhase('login')
    window.addEventListener('keydown', skip)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', skip)
    }
  }, [setPhase])

  return (
    <div className="boot" onClick={() => setPhase('login')}>
      <Icon name="logo" size={72} />
      <div className="spinner" aria-label="Starting">
        {Array.from({ length: 6 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <span className="boot-name">SameerOS</span>
    </div>
  )
}

/** Lock screen: blurred wallpaper, the big clock, and a sign-in card. */
export function Login() {
  const phase = useOS((s) => s.phase)
  const setPhase = useOS((s) => s.setPhase)

  useEffect(() => {
    if (phase !== 'welcome') return
    const t = setTimeout(() => setPhase('desktop'), 1500)
    return () => clearTimeout(t)
  }, [phase, setPhase])

  const signIn = () => {
    chime()
    setPhase('welcome')
  }

  return (
    <div className="lock" style={{ backgroundImage: `url(${WALLPAPER})` }}>
      <div className="lock-veil" />
      {phase === 'welcome' ? (
        <div className="lock-card welcome">
          <img src={profile.avatar} alt="" />
          <div className="spinner small">
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <span>Welcome</span>
        </div>
      ) : (
        <div className="lock-card">
          <img src={profile.avatar} alt="" />
          <b>{profile.name}</b>
          <small>{profile.role}</small>
          <button className="primary sign-in" autoFocus onClick={signIn}>
            Sign in
          </button>
        </div>
      )}
      <BigClock className="lock-clock" />
      {phase !== 'welcome' && (
        <button
          className="lock-power icon-btn"
          title={embedded ? 'Back to room' : 'Shut down'}
          onClick={() => (embedded ? send({ type: 'os:shutdown' }) : setPhase('off'))}
        >
          <Icon name="power" size={26} />
        </button>
      )}
    </div>
  )
}

export function Off() {
  const setPhase = useOS((s) => s.setPhase)
  useEffect(() => {
    const on = () => setPhase('boot')
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [setPhase])
  return (
    <div className="off" onClick={() => setPhase('boot')}>
      <p>SameerOS is shut down.</p>
      <small>Click anywhere or press any key to start it again</small>
    </div>
  )
}
