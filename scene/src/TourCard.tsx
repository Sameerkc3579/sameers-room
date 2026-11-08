// The recruiter tour's caption card (tour.ts): what the camera is looking at, a progress bar per stop (like
// stories), and Back / Pause / Next. It moves on by itself; hovering the card or pausing holds it.
import { useEffect, useState, type ReactNode } from 'react'
import { useScene } from './store'
import { STOPS, endTour, goTo } from './tour'
import { solvedText, useStats } from './live'
import { loadPdfLib } from './pdf'
import { profile, GITHUB, LINKEDIN, EMAIL } from '../../os/src/content/profile'
import { projects } from '../../os/src/content/projects'
import { t, useLang, useT } from './i18n'

const RESUME = './os/resume.pdf'
const ext = { target: '_blank', rel: 'noreferrer' } as const
const SKILLS = ['Python', 'PyTorch', 'Hugging Face Transformers', 'LLM agents', 'RAG', 'LangGraph', 'FastAPI', 'Docker', 'C++']

function Stats() {
  const s = useStats((x) => x.stats)
  const hi = useLang((x) => x.lang === 'hi')
  return (
    <>
      {hi ? (
        <p>
          मैं लगभग रोज़ प्रॉब्लम सॉल्विंग करता हूँ: अब तक अलग-अलग साइट्स पर <b>{solvedText(s)}</b> DSA सवाल हल किए हैं।
          {s?.github && (
            <>
              {' '}
              साथ ही पिछले साल <b>{s.github.total}</b> GitHub योगदान।
            </>
          )}
        </p>
      ) : (
        <p>
          I practise problem solving most days: <b>{solvedText(s)}</b> DSA problems solved across sites so far.
          {s?.github && (
            <>
              {' '}
              Plus <b>{s.github.total}</b> GitHub contributions in the last year.
            </>
          )}
        </p>
      )}
      <div className="tour-facts">
        {s?.leetcode && (
          <span>
            <b>{s.leetcode.solved}</b> LeetCode
          </span>
        )}
        {s?.codeforces && (
          <span>
            <b>{s.codeforces.solved}</b> Codeforces
          </span>
        )}
        <span>
          <b>{profile.education.cgpa.split(' ')[0]}</b> CGPA
        </span>
      </div>
      <p className="tour-small">
        {t('The card on the pegboard and the graph under it update themselves.', 'पेगबोर्ड पर लगा कार्ड और उसके नीचे का ग्राफ़ अपने आप अपडेट होते हैं।')}
      </p>
    </>
  )
}

function stop(i: number): { kicker: string; title: string; body: ReactNode; actions?: ReactNode } {
  const ed = profile.education
  switch (i) {
    case 0:
      return {
        kicker: t('The 60-second tour', '60 सेकंड का टूर'),
        title: t(`Hi, I'm ${profile.name}`, `नमस्ते, मैं ${profile.name} हूँ`),
        body: (
          <p>
            {t(
              `${profile.role}, and a third-year B.Tech student in Data Science & AI at IIIT Naya Raipur. I build LLM agents that do real work, and then I try to break them.`,
              `${profile.role}, और IIIT नया रायपुर में Data Science & AI में B.Tech के तीसरे साल का छात्र। मैं ऐसे LLM agents बनाता हूँ जो असली काम करते हैं, और फिर उन्हें तोड़ने की कोशिश करता हूँ।`,
            )}
          </p>
        ),
      }
    case 1:
      return {
        kicker: t('This room', 'यह कमरा'),
        title: t('A computer that actually works', 'एक कंप्यूटर जो सच में चलता है'),
        body: (
          <p>
            {t(
              'The monitor runs SameerOS, a small desktop I wrote in React: a terminal, my projects, my resume and a lo-fi player. The room around it is React Three Fiber, modelled in Blender, with Raipur’s real time and weather in the window.',
              'मॉनिटर पर SameerOS चलता है, React में लिखा मेरा छोटा-सा डेस्कटॉप: टर्मिनल, मेरे प्रोजेक्ट्स, रिज़्यूमे और एक लो-फ़ाई प्लेयर। आसपास का कमरा React Three Fiber में बना है, Blender में मॉडल किया गया, और खिड़की में रायपुर का असली समय और मौसम दिखता है।',
            )}
          </p>
        ),
      }
    case 2:
      return {
        kicker: t('Projects', 'प्रोजेक्ट्स'),
        title: t('What I’ve built', 'मैंने क्या बनाया है'),
        body: (
          <ul className="tour-projects">
            {projects.slice(0, 3).map((p) => (
              <li key={p.id}>
                <b>{p.name}</b>
                <span>{p.tagline}</span>
                {p.metric && (
                  <em>
                    {p.metric.value} <small>{p.metric.label}</small>
                  </em>
                )}
              </li>
            ))}
          </ul>
        ),
        actions: (
          <button className="cb-btn" onClick={() => endTour(true)}>
            {t('Open the projects book', 'प्रोजेक्ट्स की किताब खोलें')}
          </button>
        ),
      }
    case 3:
      return { kicker: t('Problem solving', 'प्रॉब्लम सॉल्विंग'), title: t('The numbers', 'आँकड़े'), body: <Stats /> }
    case 4:
      return {
        kicker: t('Skills & resume', 'स्किल्स और रिज़्यूमे'),
        title: t('What I work with', 'मैं किन चीज़ों के साथ काम करता हूँ'),
        body: (
          <>
            <p>
              {ed.degree}, {ed.period}. CGPA {ed.cgpa}.
            </p>
            <div className="tour-tags">
              {SKILLS.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          </>
        ),
        actions: (
          <>
            <a className="cb-btn primary" href={RESUME} download="Sameer_Choudhary_Resume.pdf">
              {t('Download resume', 'रिज़्यूमे डाउनलोड करें')}
            </a>
            <button
              className="cb-btn"
              onClick={() => {
                loadPdfLib()
                endTour(true)
              }}
            >
              {t('Read it here', 'यहीं पढ़ें')}
            </button>
          </>
        ),
      }
    default:
      return {
        kicker: t('Thanks for the visit', 'आने के लिए धन्यवाद'),
        title: t('Let’s talk', 'चलिए बात करते हैं'),
        body: (
          <p>
            {t(
              'If any of this fits what you’re building, I’d love to hear from you. Email reaches me fastest:',
              'अगर इनमें से कुछ भी आपके काम से मेल खाता है, तो मुझे आपसे सुनकर खुशी होगी। ईमेल से मैं सबसे जल्दी जवाब देता हूँ:',
            )}{' '}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </p>
        ),
        actions: (
          <>
            <a className="cb-btn primary" href={`mailto:${EMAIL}`}>
              {t('Email me', 'मुझे ईमेल करें')}
            </a>
            <a className="cb-btn" href={RESUME} download="Sameer_Choudhary_Resume.pdf">
              {t('Resume ↓', 'रिज़्यूमे ↓')}
            </a>
            <a className="cb-btn" href={LINKEDIN} {...ext}>
              LinkedIn ↗
            </a>
            <a className="cb-btn" href={GITHUB} {...ext}>
              GitHub ↗
            </a>
            <button className="cb-btn ghost" onClick={() => endTour()}>
              {t('Explore the room', 'कमरा देखें')}
            </button>
          </>
        ),
      }
  }
}

export function TourCard() {
  const at = useScene((s) => s.tour)
  useT() // redraw in the visitor's language
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false) // pointer over the card

  useEffect(() => {
    if (at === null) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea')) return
      if (e.key === 'ArrowRight') goTo(at + 1)
      else if (e.key === 'ArrowLeft') goTo(at - 1)
      else if (e.key === 'Escape') endTour()
      else if (e.key === ' ') setPaused((p) => !p)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [at])

  // phones: the chat button would sit on the card's Next button
  const on = at !== null
  useEffect(() => {
    document.body.classList.toggle('touring', on)
  }, [on])

  if (at === null) return null
  const s = stop(at)
  const ms = STOPS[at].ms
  const last = at === STOPS.length - 1
  return (
    <section
      className={`tour${last ? ' end' : ''}`}
      aria-label="Tour of Sameer's room"
      aria-live="polite"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
    >
      <div className="tour-bars" aria-hidden>
        {STOPS.map((_, i) => (
          <i key={i} className={i < at ? 'done' : ''}>
            {i === at && ms && (
              <b
                key={at}
                style={{ animationDuration: `${ms}ms`, animationPlayState: paused || held ? 'paused' : 'running' }}
                onAnimationEnd={() => goTo(at + 1)}
              />
            )}
            {i === at && !ms && <b className="full" />}
          </i>
        ))}
      </div>
      <header>
        <p className="tour-kicker">
          {s.kicker} · {at + 1}/{STOPS.length}
        </p>
        <button className="tour-x" onClick={() => endTour()} aria-label="End the tour">
          ×
        </button>
      </header>
      <div key={at} className="tour-body">
        <h2>{s.title}</h2>
        {s.body}
      </div>
      <footer>
        {s.actions && <div className="tour-actions">{s.actions}</div>}
        <div className="tour-nav">
          <button onClick={() => goTo(at - 1)} disabled={at === 0} aria-label="Previous stop">
            ←
          </button>
          {!last && (
            <button onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>
              {paused ? '▶' : '❚❚'}
            </button>
          )}
          {!last && (
            <button className="next" onClick={() => goTo(at + 1)}>
              {t('Next →', 'आगे →')}
            </button>
          )}
        </div>
      </footer>
    </section>
  )
}
