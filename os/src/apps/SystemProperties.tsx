import { useState } from 'react'
import { profile, GITHUB, LINKEDIN, EMAIL } from '../content/profile'
import { useOS } from '../store'

const TABS = ['About', 'Skills', 'Education'] as const

/** "About me", laid out like a settings page: a sidebar of sections and cards on the right. */
export function SystemProperties() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('About')
  const open = useOS((s) => s.open)

  return (
    <div className="window-body flush about">
      <nav className="side-nav">
        <div className="me-card">
          <img src={profile.avatar} alt="" />
          <b>{profile.name}</b>
          <small>{profile.role}</small>
        </div>
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <section className="about-main">
        {tab === 'About' && (
          <>
            <h2>About me</h2>
            <div className="card">
              {profile.bio.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="facts">
              <div className="card fact">
                <small>Studying</small>
                <b>B.Tech, Data Science &amp; AI</b>
                <span>IIIT Naya Raipur · 2024–2028</span>
              </div>
              <div className="card fact">
                <small>CGPA</small>
                <b>{profile.education.cgpa}</b>
                <span>{profile.location}</span>
              </div>
              <div className="card fact">
                <small>Problem solving</small>
                <b>700+ problems</b>
                <span>LeetCode &amp; Codeforces</span>
              </div>
            </div>
            <div className="row-actions">
              <button className="primary" onClick={() => open('projects')}>
                See my projects
              </button>
              <button onClick={() => open('resume')}>Resume</button>
              <a className="button" href={GITHUB} target="_blank" rel="noreferrer">
                GitHub ↗
              </a>
              <a className="button" href={LINKEDIN} target="_blank" rel="noreferrer">
                LinkedIn ↗
              </a>
              <a className="button" href={`mailto:${EMAIL}`}>
                Email
              </a>
            </div>
          </>
        )}

        {tab === 'Skills' && (
          <>
            <h2>Skills</h2>
            {Object.entries(profile.skills).map(([group, items]) => (
              <div key={group} className="card">
                <h4>{group}</h4>
                <div className="chips">
                  {items.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'Education' && (
          <>
            <h2>Education</h2>
            <div className="card">
              <h4>{profile.education.school}</h4>
              <p>
                {profile.education.degree}
                <br />
                {profile.education.period} · CGPA <b>{profile.education.cgpa}</b>
              </p>
            </div>
            {Object.entries(profile.coursework).map(([group, items]) => (
              <div key={group} className="card">
                <h4>{group}</h4>
                <div className="chips">
                  {items.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              </div>
            ))}
            <div className="card">
              <h4>Achievements</h4>
              {profile.achievements.map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
