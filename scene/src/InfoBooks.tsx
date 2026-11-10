// The projects (books under the riser) and about-me (quote print) books. Content is shared with SameerOS
// (os/src/content), so the room and the OS never disagree.
import { useState } from 'react'
import { Book, Cover } from './Book'
import { page as turnPage } from './sound'
import { singlePage, useScene } from './store'
import { profile, GITHUB, LINKEDIN, EMAIL } from '../../os/src/content/profile'
import { projects, alsoBuilt, type Project } from '../../os/src/content/projects'

const AVATAR = './os/avatar.svg'
const ext = { target: '_blank', rel: 'noreferrer' } as const

/* ---------- projects ---------- */

/** left page: the table of contents */
function ProjectIndex({ sel, onPick }: { sel: Project | null; onPick: (p: Project) => void }) {
  return (
    <div className="bk-flow">
      <h3>Projects</h3>
      <p className="cb-role">What I've built lately</p>
      <ol className="bk-toc">
        {projects.map((p, i) => (
          <li key={p.id}>
            <button className={sel?.id === p.id ? 'on' : ''} onClick={() => onPick(p)}>
              <span className="toc-no">{String(i + 1).padStart(2, '0')}</span>
              <span className="toc-text">
                <b>{p.name}</b>
                <small>{p.tagline}</small>
              </span>
              {p.metric && <em>{p.metric.value}</em>}
            </button>
          </li>
        ))}
      </ol>
      <h4>Also built</h4>
      <div className="bk-chips">
        {alsoBuilt.map((p) => (
          <button key={p.id} className={sel?.id === p.id ? 'on' : ''} onClick={() => onPick(p)}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="cb-actions">
        <a className="cb-btn" href={GITHUB} {...ext}>
          All on GitHub ↗
        </a>
      </div>
    </div>
  )
}

/** right page: one project */
function ProjectPage({ p, onBack }: { p: Project; onBack?: () => void }) {
  const n = projects.indexOf(p)
  return (
    <div className="bk-flow page-text">
      {onBack && (
        <button className="bk-back" onClick={onBack}>
          ← All projects
        </button>
      )}
      <p className="bk-kicker">{n >= 0 ? `Project ${String(n + 1).padStart(2, '0')}` : 'Also built'}</p>
      <h3>{p.name}</h3>
      <p className="bk-sub">
        {p.tagline}
        {p.period && ` · ${p.period}`}
      </p>
      {p.metric && (
        <div className="bk-metric">
          <b>{p.metric.value}</b>
          <span>{p.metric.label}</span>
        </div>
      )}
      <ul className="bk-bullets">
        {p.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <div className="bk-tags">
        {p.stack.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="cb-actions">
        <a className="cb-btn primary" href={p.github} {...ext}>
          View on GitHub ↗
        </a>
        {p.demo && (
          <a className="cb-btn" href={p.demo} {...ext}>
            Live demo ↗
          </a>
        )}
      </div>
    </div>
  )
}

const byId = (id: string | null) => [...projects, ...alsoBuilt].find((p) => p.id === id) ?? null

export function ProjectsBook() {
  const single = singlePage()
  const page = useScene((s) => s.page) // set when the chat agent opens a particular project
  // the open spread always shows a project on the right; phones start on the list
  const [sel, setSel] = useState<Project | null>(byId(page) ?? (single ? null : projects[0]))
  const [turns, setTurns] = useState(0)
  const pick = (p: Project) => {
    if (p.id === sel?.id) return
    turnPage()
    setSel(p)
    setTurns((t) => t + 1)
  }
  // the agent can turn to another project while the book is open (adjusting state during render, as React suggests)
  const [shown, setShown] = useState(page)
  if (page !== shown) {
    setShown(page)
    const p = byId(page)
    if (p) pick(p)
  }
  return (
    <Book
      label="Projects"
      tint="forest"
      cover={<Cover title="Projects" line={`${projects.length + alsoBuilt.length} things I've built`} small={profile.name} />}
      inside={<ProjectIndex sel={sel} onPick={pick} />}
      page={
        <div key={sel?.id ?? 'list'} className="bk-page-in">
          {single && !sel ? (
            <ProjectIndex sel={null} onPick={pick} />
          ) : (
            sel && <ProjectPage p={sel} onBack={single ? () => setSel(null) : undefined} />
          )}
        </div>
      }
      // a blank leaf turns over from the right page to the left whenever you pick another project
      overlay={!single && turns > 0 && <div key={turns} className="book-leaf" aria-hidden />}
    />
  )
}

/* ---------- about me ---------- */

function Identity() {
  const { education: ed } = profile
  return (
    <>
      <div className="bk-me">
        <img src={AVATAR} alt="" />
        <div>
          <h3>{profile.name}</h3>
          <p className="cb-role">
            {profile.role} · {profile.location}
          </p>
        </div>
      </div>
      <div className="bk-card">
        <small>Education</small>
        <b>{ed.degree}</b>
        <span>{ed.school}</span>
        <span>
          {ed.period} · CGPA {ed.cgpa}
        </span>
      </div>
    </>
  )
}

function Reach() {
  return (
    <div className="cb-actions">
      <a className="cb-btn primary" href={`mailto:${EMAIL}`}>
        Email me
      </a>
      <a className="cb-btn" href={GITHUB} {...ext}>
        GitHub ↗
      </a>
      <a className="cb-btn" href={LINKEDIN} {...ext}>
        LinkedIn ↗
      </a>
    </div>
  )
}

function Story({ single }: { single: boolean }) {
  return (
    <div className="bk-flow page-text">
      {single && <Identity />}
      <p className="bk-kicker">About me</p>
      {profile.bio.map((b, i) => (
        <p key={i} className={i === 0 ? 'bk-lead' : 'bk-p'}>
          {b}
        </p>
      ))}
      <div className="bk-facts">
        <div>
          <b>{profile.education.cgpa.split(' ')[0]}</b>
          <span>CGPA</span>
        </div>
        <div>
          <b>700+</b>
          <span>DSA problems</span>
        </div>
        <div>
          <b>{projects.length + alsoBuilt.length}</b>
          <span>projects</span>
        </div>
      </div>
      <h4>Toolbox</h4>
      {Object.entries(profile.skills).map(([group, items]) => (
        <div key={group} className="bk-skill">
          <small>{group}</small>
          <div className="bk-tags">
            {items.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
      ))}
      {single && <Reach />}
      {/* the puzzle hunt's second clue (hunt.ts), pencilled into the margin */}
      <p className="margin-note" aria-label="A pencilled note in the margin">
        <small>Caesar was here:</small>
        Wxuq wkh oljkwv rii. Orrn dw wkh zdoo. D lv rqh.
      </p>
    </div>
  )
}

export function AboutBook() {
  const single = singlePage()
  return (
    <Book
      label="About me"
      tint="clay"
      cover={<Cover title="About me" line={profile.name} small={`${profile.role} · ${profile.location}`} />}
      inside={
        <div className="bk-center">
          <Identity />
          <h4>Coursework</h4>
          {Object.entries(profile.coursework).map(([group, items]) => (
            <p key={group} className="bk-course">
              <small>{group}</small>
              {items.join(' · ')}
            </p>
          ))}
          <h4>Say hello</h4>
          <Reach />
        </div>
      }
      page={<Story single={single} />}
    />
  )
}
