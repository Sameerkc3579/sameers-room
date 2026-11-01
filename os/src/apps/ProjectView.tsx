import type { Win } from '../store'
import { allProjects } from '../content/projects'
import { Icon } from '../shell/icons'

export function ProjectView({ win }: { win: Win }) {
  const p = allProjects.find((x) => x.id === win.props.id)
  if (!p) return <div className="window-body">Project not found.</div>

  return (
    <div className="window-body flush project">
      <div className="pv-scroll">
        <header className="pv-head">
          <Icon name="folder-docs" size={48} />
          <div>
            <h2>{p.name}</h2>
            <p>{p.tagline}</p>
            <small>{[p.period, p.team].filter(Boolean).join(' · ')}</small>
          </div>
        </header>

        {p.metric && (
          <div className="pv-metric">
            <span>{p.metric.value}</span>
            <small>{p.metric.label}</small>
          </div>
        )}

        <div className="chips">
          {p.stack.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>

        <ul className="pv-bullets">
          {p.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
      <div className="pv-actions">
        {p.demo && (
          <a className="button" href={p.demo} target="_blank" rel="noreferrer">
            Live demo ↗
          </a>
        )}
        <a className="button primary" href={p.github} target="_blank" rel="noreferrer">
          View on GitHub ↗
        </a>
      </div>
    </div>
  )
}
