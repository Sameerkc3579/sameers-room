// The chat box in the room's corner: talk to a bot version of Sameer (agent.ts, brain.ts), by typing or, where the browser
// supports it, by voice. It stays put while books open around it; it hides while the visitor uses the computer.
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useScene } from './store'
import { GREETING, MAX_TEXT, send, useChat } from './agent'
import { useT } from './i18n'

const AVATAR = './os/avatar.svg'
// the bot answers in English (brain.ts understands Hinglish too), so the Hindi greeting says so
const GREETING_HI =
  'नमस्ते! मैं Sameer का bot हूँ। मेरे काम के बारे में पूछिए, या कमरे में कुछ दिखाने को कहिए। मैं Hinglish समझता हूँ, पर जवाब English में देता हूँ।'

/** Turns links and email addresses in a reply into clickable ones. */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+[^\s).,!?]|[\w.+-]+@[\w-]+\.[\w.]*\w)/g)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <a key={i} href={p.includes('@') && !p.startsWith('http') ? `mailto:${p}` : p} target="_blank" rel="noreferrer">
            {p}
          </a>
        ),
      )}
    </>
  )
}

/* ---------- voice input (Web Speech API: Chrome, Edge, Safari) ---------- */

interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
const SpeechRecognition = ((window as unknown as Record<string, unknown>).SpeechRecognition ??
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognition) | undefined

function useVoice(onText: (text: string, done: boolean) => void) {
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const toggle = () => {
    if (!SpeechRecognition) return
    if (rec.current) return rec.current.stop()
    const r = new SpeechRecognition()
    r.lang = 'en-IN' // Indian English; it copes with Hinglish too
    r.interimResults = true
    let said = ''
    r.onresult = (e) => {
      said = Array.from(e.results, (x) => x[0].transcript).join('')
      onText(said, false)
    }
    r.onend = () => {
      rec.current = null
      setListening(false)
      if (said) onText(said, true)
    }
    r.onerror = () => r.stop()
    rec.current = r
    setListening(true)
    r.start()
  }
  return { supported: Boolean(SpeechRecognition), listening, toggle }
}

/* ---------- the box ---------- */

export function Chat() {
  const { open, busy, messages, setOpen } = useChat()
  const hidden = useScene((s) => s.view === 'screen')
  // in the room the chat opens from the bottom dock (Overlay.tsx); zoomed in, or on the tour, it keeps a button here
  const docked = useScene((s) => s.view === 'room' && s.tour === null)
  const t = useT()
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const voice = useVoice((t, done) => {
    if (done) {
      setText('')
      send(t)
    } else setText(t)
  })

  // open books make room for the box (book.css)
  useEffect(() => {
    document.body.classList.toggle('chat-open', open)
  }, [open])

  // keep the newest message in view
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(text)
    setText('')
  }
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation() // typing here mustn't zoom the resume or close a book
    if (e.key === 'Escape') setOpen(false)
  }

  if (!open && docked) return null
  if (!open)
    return (
      <button className={`chat-pill${hidden ? ' hidden' : ''}`} onClick={() => setOpen(true)}>
        <img src={AVATAR} alt="" />
        <span>{t('Ask ', '')}<b>Sameer</b>{t('', ' से पूछें')}</span>
        {messages.length > 1 && <i className="chat-unread" aria-hidden />}
      </button>
    )

  return (
    <section className={`chat${hidden ? ' hidden' : ''}`} aria-label="Chat with Sameer's bot" onKeyDown={onKey}>
      <header>
        <img src={AVATAR} alt="" />
        <div>
          <b>{t('Sameer’s bot', 'Sameer का bot')}</b>
          <small>{t('Knows my work · moves things in the room', 'मेरा काम जानता है · कमरे में चीज़ें चलाता है')}</small>
        </div>
        <button className="chat-min" onClick={() => setOpen(false)} aria-label="Minimise chat">
          –
        </button>
      </header>
      <div className="chat-list" ref={list} aria-live="polite">
        {messages.map((m, i) => (
          <p key={i} className={`chat-msg ${m.role}`}>
            <Linked text={m === GREETING ? t(m.text, GREETING_HI) : m.text} />
          </p>
        ))}
        {busy && (
          <p className="chat-msg assistant typing" aria-label="Typing">
            <i />
            <i />
            <i />
          </p>
        )}
        {!busy && messages.at(-1)?.suggest && (
          <div className="chat-suggest">
            {messages.at(-1)!.suggest!.map((s) => (
              <button key={s} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input
          value={text}
          maxLength={MAX_TEXT}
          placeholder={voice.listening ? t('Listening…', 'सुन रहा हूँ…') : t('Ask me anything…', 'कुछ भी पूछें… (English या Hinglish में)')}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          aria-label="Your message"
        />
        {voice.supported && (
          <button
            type="button"
            className={`chat-mic${voice.listening ? ' on' : ''}`}
            onClick={voice.toggle}
            aria-label={voice.listening ? 'Stop listening' : 'Speak'}
            title="Speak"
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" />
            </svg>
          </button>
        )}
        <button className="chat-send" disabled={busy || !text.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
          </svg>
        </button>
      </form>
    </section>
  )
}
