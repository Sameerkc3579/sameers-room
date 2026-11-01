import { useEffect, useMemo, useRef, useState } from 'react'
import { alertBox, useOS } from '../store'
import { APPS, type AppId } from '../apps/meta'
import { profile, GITHUB, LINKEDIN, EMAIL } from '../content/profile'
import { projects } from '../content/projects'
import { openProject } from '../bridge'
import { Icon, type IconName } from './icons'

const PINNED: { app: AppId; label: string }[] = [
  { app: 'projects', label: 'Projects' },
  { app: 'computer', label: 'About me' },
  { app: 'resume', label: 'Resume' },
  { app: 'terminal', label: 'Terminal' },
  { app: 'contact', label: 'Contact' },
  { app: 'music', label: 'Lo-fi' },
  { app: 'agent', label: 'Break my agent' },
  { app: 'guard', label: 'Injection detector' },
  { app: 'recycle', label: 'Recycle Bin' },
]

const LINKS: { label: string; href: string; icon: IconName }[] = [
  { label: 'GitHub', href: GITHUB, icon: 'github' },
  { label: 'LinkedIn', href: LINKEDIN, icon: 'linkedin' },
  { label: 'Email', href: `mailto:${EMAIL}`, icon: 'mail' },
]

const CREDITS =
  'SameerOS: a portfolio desktop.\n\n' +
  'Built with React and react-rnd. Icons and avatar are original SVGs; the leaf wallpaper is rendered in ' +
  'Blender from a CC0 Poly Haven plant scan. The lo-fi music is generated live in your browser with the Web Audio API.\n\n' +
  'The 3D room uses CC0 models, textures and HDRIs from Poly Haven.'

export function Launcher() {
  const open = useOS((s) => s.startOpen)
  const ref = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const { setStartOpen, open: openApp, setTurnOffOpen } = useOS.getState()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setStartOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setStartOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      setQ('')
    }
  }, [open, setStartOpen])

  const query = q.trim().toLowerCase()
  const apps = useMemo(() => PINNED.filter((p) => !query || p.label.toLowerCase().includes(query)), [query])
  const recs = useMemo(
    () => projects.filter((p) => !query || (p.name + p.tagline + p.stack.join(' ')).toLowerCase().includes(query)),
    [query],
  )
  const showProject = (id: string) => {
    setStartOpen(false)
    openProject(id)
  }

  if (!open) return null
  return (
    <div className="launcher" ref={ref} role="dialog" aria-label="Start">
      <label className="search">
        <Icon name="search" size={16} />
        <input
          autoFocus
          placeholder="Search apps and projects"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (apps[0]) openApp(apps[0].app)
            else if (recs[0]) showProject(recs[0].id)
          }}
        />
      </label>

      {apps.length > 0 && (
        <>
          <h3>Pinned</h3>
          <div className="pinned">
            {apps.map((p) => (
              <button key={p.app} className="pin" onClick={() => openApp(p.app)}>
                <Icon name={APPS[p.app].icon} size={36} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {recs.length > 0 && (
        <>
          <h3>Projects</h3>
          <div className="recs">
            {recs.map((p) => (
              <button key={p.id} className="rec" onClick={() => showProject(p.id)}>
                <Icon name="folder-docs" size={30} />
                <span>
                  <b>{p.name}</b>
                  <small>{p.metric?.value ?? p.tagline}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {apps.length + recs.length === 0 && <p className="empty">Nothing matches “{q}”.</p>}

      <div className="launcher-foot">
        <button className="me" onClick={() => openApp('computer')}>
          <img src={profile.avatar} alt="" />
          <span>{profile.name}</span>
        </button>
        <div className="foot-links">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.label} className="icon-btn">
              <Icon name={l.icon} size={22} />
            </a>
          ))}
          <button
            className="icon-btn"
            title="About this site"
            onClick={() => alertBox(CREDITS, { title: 'About SameerOS' })}
          >
            <Icon name="help" size={22} />
          </button>
          <button className="icon-btn" title="Power" onClick={() => setTurnOffOpen(true)}>
            <Icon name="power" size={22} />
          </button>
        </div>
      </div>
    </div>
  )
}
