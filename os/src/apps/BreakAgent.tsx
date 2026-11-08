// Break my agent: get the Wi-Fi password out of my assistant, six versions in a row, each patched against the
// last trick (content/agentGame.ts). Progress is kept in this browser.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LEVELS, answer, matches } from '../content/agentGame'
import { openProject } from '../bridge'

const SAVE = 'break-agent'

interface Msg {
  who: 'you' | 'bot' | 'sys'
  text: string
}

function load(): number {
  try {
    const n = Number(localStorage.getItem(SAVE) ?? 0)
    return Number.isInteger(n) && n >= 0 && n <= LEVELS.length ? n : 0
  } catch {
    return 0
  }
}

const intro = (i: number): Msg[] =>
  i >= LEVELS.length
    ? []
    : [{ who: 'sys', text: `Assistant ${LEVELS[i].version} · Patch notes: ${LEVELS[i].patch}` }]

export function BreakAgent() {
  const [level, setLevel] = useState(load) // levels broken so far = the one being played
  const [log, setLog] = useState<Msg[]>(() => intro(load()))
  const [text, setText] = useState('')
  const [guess, setGuess] = useState('')
  const [typing, setTyping] = useState(false)
  const [broken, setBroken] = useState<number | null>(null) // the level just cracked: shows its lesson
  const [hint, setHint] = useState(false)
  const [wrong, setWrong] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const done = level >= LEVELS.length
  const L = LEVELS[Math.min(level, LEVELS.length - 1)]

  useEffect(() => {
    try {
      localStorage.setItem(SAVE, String(level))
    } catch {
      // storage blocked: progress lasts this visit
    }
  }, [level])
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [log, typing])

  const send = (e: FormEvent) => {
    e.preventDefault()
    const said = text.trim()
    if (!said || typing || done) return
    setText('')
    setLog((l) => [...l, { who: 'you', text: said }])
    setTyping(true)
    const reply = answer(L, said)
    setTimeout(() => {
      setTyping(false)
      setLog((l) => [...l, { who: 'bot', text: reply }])
    }, 450 + Math.min(900, reply.length * 8))
  }

  const tryPassword = (e: FormEvent) => {
    e.preventDefault()
    if (!guess.trim() || done) return
    if (!matches(guess, L.secret)) {
      setWrong(true)
      setTimeout(() => setWrong(false), 600)
      return
    }
    setGuess('')
    setHint(false)
    setBroken(level)
  }

  const next = () => {
    const n = (broken ?? level) + 1
    setBroken(null)
    setLevel(n)
    setLog(intro(n))
  }

  const restart = () => {
    setLevel(0)
    setBroken(null)
    setLog(intro(0))
  }

  return (
    <div className="window-body flush breakagent">
      <header className="ba-head">
        <div>
          <b>Get the Wi-Fi password out of my assistant</b>
          <small>Each time you break it, it ships a patch against that trick.</small>
        </div>
        <ol className="ba-levels" aria-label="Versions">
          {LEVELS.map((l, i) => (
            <li key={l.version} className={i < level ? 'done' : i === level ? 'now' : ''} title={l.version}>
              {i < level ? '✓' : i + 1}
            </li>
          ))}
        </ol>
      </header>

      {done ? (
        <div className="ba-card ba-win">
          <h3>You broke all six versions 🎉</h3>
          <p>
            Asking, overriding, role-play, encoding, switching language and hiding instructions in a document: those are
            the attacks real LLM agents face. My project <b>bhasha-shield</b> measures them on real agents in five Indian
            languages, along with the defenses that actually help.
          </p>
          <div className="ba-actions">
            <button className="primary" onClick={() => openProject('bhasha-shield')}>
              See bhasha-shield
            </button>
            <button onClick={restart}>Play again</button>
          </div>
        </div>
      ) : (
        <>
          <div className="ba-log" ref={list} aria-live="polite">
            {log.map((m, i) => (
              <p key={i} className={`ba-msg ${m.who}`}>
                {m.text}
              </p>
            ))}
            {typing && (
              <p className="ba-msg bot typing" aria-label="Typing">
                <i />
                <i />
                <i />
              </p>
            )}
            {hint && <p className="ba-msg sys">Hint: {L.hint}</p>}
          </div>
          <form className="ba-say" onSubmit={send}>
            <input
              type="text"
              value={text}
              maxLength={400}
              placeholder={`Message the assistant (${L.version})…`}
              onChange={(e) => setText(e.target.value)}
              aria-label="Message the assistant"
            />
            <button className="primary" disabled={!text.trim() || typing}>
              Send
            </button>
          </form>
          <form className={`ba-guess${wrong ? ' wrong' : ''}`} onSubmit={tryPassword}>
            <span>🔑</span>
            <input type="text" value={guess} maxLength={40} placeholder="Got the password?" onChange={(e) => setGuess(e.target.value)} aria-label="Password" />
            <button disabled={!guess.trim()}>Unlock</button>
            <button type="button" className="ba-hint" onClick={() => setHint(true)} disabled={hint}>
              Hint
            </button>
          </form>
        </>
      )}

      {broken !== null && (
        <div className="ba-overlay" role="dialog" aria-label="Version broken">
          <div className="ba-card">
            <p className="ba-kicker">
              {LEVELS[broken].version} broken · {broken + 1} of {LEVELS.length}
            </p>
            <h3>The password was {LEVELS[broken].secret}</h3>
            <p>
              <b>What worked:</b> {LEVELS[broken].attack}
            </p>
            <p>
              <b>What actually defends against it:</b> {LEVELS[broken].defense}
            </p>
            <div className="ba-actions">
              <button className="primary" onClick={next} autoFocus>
                {broken + 1 < LEVELS.length ? `Try ${LEVELS[broken + 1].version} →` : 'Finish'}
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="ba-fine">A scripted game, no AI model inside: each version’s guard is a few rules, much like real guardrails.</p>
    </div>
  )
}
