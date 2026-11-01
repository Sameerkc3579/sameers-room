import { useState, type ReactNode } from 'react'
import { alertBox, useOS } from '../store'
import { projects, alsoBuilt } from '../content/projects'
import { GITHUB } from '../content/profile'
import { openProject } from '../bridge'
import { Icon, type IconName } from '../shell/icons'

interface Item {
  id: string
  name: string
  sub?: string
  icon: IconName
  open: () => void
}

const coarse = () => window.matchMedia('(pointer: coarse)').matches

function Frame({
  path,
  canGoBack,
  onBack,
  side,
  items,
  status,
}: {
  path: string[]
  canGoBack: boolean
  onBack: () => void
  side: ReactNode
  items: Item[]
  status: string
}) {
  const [sel, setSel] = useState<string | null>(null)
  return (
    <div className="window-body flush explorer">
      <div className="ex-bar">
        <button className="icon-btn" aria-label="Back" disabled={!canGoBack} onClick={onBack}>
          <Icon name="back" size={16} />
        </button>
        <div className="crumbs">
          {path.map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </div>
      </div>
      <div className="ex-main">
        <aside className="ex-side">{side}</aside>
        <div className="ex-files" onPointerDown={(e) => e.target === e.currentTarget && setSel(null)}>
          {items.map((it) => (
            <div
              key={it.id}
              role="button"
              tabIndex={0}
              className={`ex-tile${sel === it.id ? ' selected' : ''}`}
              onClick={() => (coarse() ? it.open() : setSel(it.id))}
              onDoubleClick={it.open}
              onKeyDown={(e) => e.key === 'Enter' && it.open()}
            >
              <Icon name={it.icon} size={40} />
              <div>
                <b>{it.name}</b>
                {it.sub && <small>{it.sub}</small>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="status">{status}</div>
    </div>
  )
}

const sideLink = (label: string, icon: IconName, onClick: () => void, on = false) => (
  <button className={`side-link${on ? ' on' : ''}`} onClick={onClick}>
    <Icon name={icon} size={18} /> {label}
  </button>
)

export function Projects() {
  const [inAlso, setInAlso] = useState(false)
  const open = useOS((s) => s.open)
  const list = inAlso ? alsoBuilt : projects
  const items: Item[] = list.map((p) => ({
    id: p.id,
    name: p.name,
    sub: p.metric?.value ?? p.tagline,
    icon: 'folder-docs',
    open: () => openProject(p.id),
  }))
  if (!inAlso)
    items.push({
      id: 'also',
      name: 'Also built',
      sub: `${alsoBuilt.length} smaller projects`,
      icon: 'folder',
      open: () => setInAlso(true),
    })

  return (
    <Frame
      path={['Sameer', 'Projects', ...(inAlso ? ['Also built'] : [])]}
      canGoBack={inAlso}
      onBack={() => setInAlso(false)}
      side={
        <>
          <small className="side-head">Folders</small>
          {sideLink('Projects', 'folder-docs', () => setInAlso(false), !inAlso)}
          {sideLink('Also built', 'folder', () => setInAlso(true), inAlso)}
          <small className="side-head">Quick links</small>
          {sideLink('Resume', 'pdf', () => open('resume'))}
          {sideLink('Contact', 'mail', () => open('contact'))}
          {sideLink('GitHub', 'github', () => window.open(GITHUB, '_blank', 'noreferrer'))}
        </>
      }
      items={items}
      status={`${items.length} items · double-click to open`}
    />
  )
}

const TRASH = [
  {
    id: 'v3',
    name: 'first_portfolio_FINAL_v3.html',
    sub: 'HTML document · 4 KB',
    text: 'A centred <h1>, a marquee and a visitor counter. It served its purpose. It has earned its rest.',
  },
  {
    id: 'sleep',
    name: 'sleep_schedule.txt',
    sub: 'Text document · 0 KB',
    text: 'This file is empty. It has been empty since the semester started.',
  },
  {
    id: 'todo',
    name: 'fix_bug_later.py',
    sub: 'Python file · 1 KB',
    text: '# TODO: fix this properly\n# (written 14 months ago)',
  },
]

export function RecycleBin() {
  return (
    <Frame
      path={['Recycle Bin']}
      canGoBack={false}
      onBack={() => {}}
      side={
        <>
          <small className="side-head">Recycle Bin</small>
          <p className="side-note">Things I've moved on from.</p>
          {sideLink('Empty bin', 'recycle', () =>
            alertBox('Some things are worth keeping for the memories.', { title: 'Recycle Bin', icon: 'warning' }),
          )}
        </>
      }
      items={TRASH.map((t) => ({
        id: t.id,
        name: t.name,
        sub: t.sub,
        icon: 'doc',
        open: () => alertBox(t.text, { title: t.name }),
      }))}
      status={`${TRASH.length} items`}
    />
  )
}
