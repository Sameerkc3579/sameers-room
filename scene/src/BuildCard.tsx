// The card for the "how it was built" replay (build.ts): the commit that's going up right now, as it reads in the
// git log, a progress bar across the whole build with a tick for each day, and back / pause / next / close. It ends
// on a card with a link to the repo.
import { useEffect, useRef } from 'react'
import { BEATS, COMMITS, END, REPO, START, TOTAL, clock, seek, startBuild, stopBuild, useBuild } from './build'
import { useChat } from './agent'
import { singlePage } from './store'
import { t, useT } from './i18n'

/** where each new day starts on the progress bar */
const DAYS = BEATS.flatMap((b, i) => {
  const day = COMMITS[b.commits[0]].day[0]
  return i > 0 && day !== COMMITS[BEATS[i - 1].commits[0]].day[0] ? [START[i] / TOTAL] : []
})

export function BuildCard() {
  const at = useBuild((s) => s.at)
  const paused = useBuild((s) => s.paused)
  useT() // redraw in the visitor's language
  const bar = useRef<HTMLElement>(null)

  const on = at !== null
  useEffect(() => {
    document.body.classList.toggle('building', on)
    // phones: the open chat would cover the room being built
    if (on && singlePage()) useChat.getState().setOpen(false)
  }, [on])

  // the bar follows the replay's own clock (it pauses and jumps with it)
  useEffect(() => {
    if (at === null || at === END) return
    let id = 0
    const draw = () => {
      if (bar.current) bar.current.style.transform = `scaleX(${clock.ms / TOTAL})`
      id = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(id)
  }, [at])

  useEffect(() => {
    if (at === null) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea')) return
      if (e.key === 'ArrowRight') seek(at + 1)
      else if (e.key === 'ArrowLeft') back(at)
      else if (e.key === 'Escape') stopBuild()
      else if (e.key === ' ' && at !== END) useBuild.setState({ paused: !paused })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [at, paused])

  if (at === null) return null
  if (at === END) {
    const first = COMMITS[0].day
    const last = COMMITS[COMMITS.length - 1].day
    return (
      <section className="tour build end" aria-label={t('How this room was built', 'यह कमरा कैसे बना')} aria-live="polite">
        <header>
          <p className="tour-kicker">
            {t(`${first[0]} → ${last[0]} · ${COMMITS.length} commits`, `${first[1]} → ${last[1]} · ${COMMITS.length} कमिट`)}
          </p>
          <button className="tour-x" onClick={stopBuild} aria-label={t('Close', 'बंद करें')}>
            ×
          </button>
        </header>
        <div className="tour-body">
          <h2>{t('That’s the whole room, one commit at a time', 'यही है पूरा कमरा, एक-एक कमिट करके')}</h2>
          <p>
            {t(
              'The Blender scripts that model the room, SameerOS and everything you just watched are in one public repo.',
              'कमरे को मॉडल करने वाली Blender स्क्रिप्ट्स, SameerOS और जो कुछ आपने अभी देखा, सब एक पब्लिक रिपो में है।',
            )}
          </p>
        </div>
        <footer>
          <div className="tour-actions">
            <a className="cb-btn primary" href={REPO} target="_blank" rel="noreferrer">
              {t('See the code on GitHub ↗', 'GitHub पर कोड देखें ↗')}
            </a>
            <button className="cb-btn" onClick={startBuild}>
              {t('Watch again', 'फिर से देखें')}
            </button>
            <button className="cb-btn ghost" onClick={stopBuild}>
              {t('Explore the room', 'कमरा देखें')}
            </button>
          </div>
        </footer>
      </section>
    )
  }

  const beat = at >= 0 ? BEATS[at] : null
  const commits = beat ? beat.commits.map((i) => ({ i, ...COMMITS[i] })) : []
  const day = beat ? commits[0].day : COMMITS[0].day
  const n = commits.map((c) => c.i + 1)
  const count = n.length > 1 ? `${n[0]}–${n[n.length - 1]}` : `${n[0]}`
  return (
    <section className="tour build" aria-label={t('How this room was built', 'यह कमरा कैसे बना')}>
      <div className="build-bar" aria-hidden>
        <b ref={bar} />
        {DAYS.map((x) => (
          <i key={x} style={{ left: `${x * 100}%` }} />
        ))}
      </div>
      <header>
        <p className="tour-kicker">
          {beat
            ? t(`${day[0]} · commit ${count} of ${COMMITS.length}`, `${day[1]} · ${COMMITS.length} में से कमिट ${count}`)
            : t(`Rewinding to ${day[0]}…`, `${day[1]} पर वापस…`)}
        </p>
        <button className="tour-x" onClick={stopBuild} aria-label={t('Stop the replay', 'रीप्ले बंद करें')}>
          ×
        </button>
      </header>
      <div className="build-log" aria-live="polite">
        {beat ? (
          <>
            <ul key={`commits-${beat.commits.join()}`}>
              {commits.map((c) => (
                <li key={c.i}>
                  <code>{c.hash}</code> <span>{c.title}</span>
                </li>
              ))}
            </ul>
            {beat.line && (
              <p key={`line-${at}`} className="build-line">
                {t(...beat.line)}
              </p>
            )}
          </>
        ) : (
          <ul>
            <li>
              <code>git</code> <span>checkout {COMMITS[0].hash}</span>
            </li>
          </ul>
        )}
      </div>
      <footer>
        <div className="tour-nav">
          <button onClick={() => back(at)} disabled={at < 0} aria-label={t('Previous commit', 'पिछला कमिट')}>
            ←
          </button>
          <button onClick={() => useBuild.setState({ paused: !paused })} aria-label={paused ? t('Play', 'चलाएँ') : t('Pause', 'रोकें')}>
            {paused ? '▶' : '❚❚'}
          </button>
          <button onClick={() => seek(at + 1)} aria-label={t('Next commit', 'अगला कमिट')}>
            →
          </button>
          <button className="next" onClick={() => seek(END)}>
            {t('Skip to the end', 'सीधे अंत पर')}
          </button>
        </div>
      </footer>
    </section>
  )
}

/** ← goes back to the start of this commit, or to the one before if this one has only just begun */
function back(at: number) {
  if (at < 0) return
  if (at >= END) return seek(END - 1)
  seek(clock.ms - START[at] > 700 || at === 0 ? at : at - 1)
}
