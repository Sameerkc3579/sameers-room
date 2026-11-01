import { useEffect } from 'react'
import { useOS } from './store'
import { listen, send } from './bridge'
import { IconDefs } from './shell/icons'
import { Desktop } from './shell/Desktop'
import { Boot, Login, Off } from './boot/Screens'

export default function App() {
  const phase = useOS((s) => s.phase)
  const sound = useOS((s) => s.sound)

  useEffect(() => listen(), [])
  useEffect(() => {
    if (phase === 'desktop') send({ type: 'os:ready' })
  }, [phase])
  useEffect(() => {
    send({ type: 'os:sound', on: sound })
  }, [sound])

  return (
    <>
      <IconDefs />
      {phase === 'boot' && <Boot />}
      {(phase === 'login' || phase === 'welcome') && <Login />}
      {phase === 'desktop' && <Desktop />}
      {phase === 'off' && <Off />}
    </>
  )
}
