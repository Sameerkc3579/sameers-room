// The guestbook: click the sticky notes beside the monitor and it opens as a book. Write a note on the left page,
// read everyone's on the right. Notes go up straight away (checks in server/guestbook.js).
import { useEffect, useState, type FormEvent } from 'react'
import { Book, Cover } from './Book'
import { singlePage } from './store'
import { LIMITS, NOTE_COLORS, deleteNote, loadNotes, postNote, useNotes, type Note, type NoteColor } from './live'
import { useT } from './i18n'

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** a stable little tilt per note, so the wall looks hand-pinned */
const tilt = (id: string) => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return ((h % 7) - 3) * 0.6
}

function Write() {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [color, setColor] = useState<NoteColor>('yellow')
  const [website, setWebsite] = useState('') // honeypot: hidden from people, bots fill it in
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({ busy: false, msg: null, ok: false })
  const status = useNotes((s) => s.status)
  const t = useT()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state.busy || text.trim().length < 2) return
    setState({ busy: true, msg: null, ok: false })
    const err = await postNote({ name, text, color, website })
    setState({
      busy: false,
      msg: err ?? t('Pinned! Your leaf is growing on the vine along my top shelf.', 'लग गया! ऊपर वाली शेल्फ़ की बेल पर आपकी पत्ती उग रही है।'),
      ok: !err,
    })
    if (!err) setText('')
  }

  if (status === 'offline')
    return <p className="gb-msg">{t('The guestbook opens soon. Come back in a bit!', 'गेस्टबुक जल्द खुलेगी। थोड़ी देर में फिर आइए!')}</p>

  return (
    <form className="gb-form" onSubmit={submit}>
      <label>
        <span>{t('Your note', 'आपका संदेश')}</span>
        <textarea
          value={text}
          maxLength={LIMITS.text}
          rows={4}
          placeholder={t("Say hi, share a thought, or tell me what you'd build next…", 'नमस्ते कहिए, कोई विचार बताइए, या बताइए कि आगे क्या बनाना चाहिए…')}
          onChange={(e) => setText(e.target.value)}
          style={{ background: NOTE_COLORS[color] }}
          required
        />
        <small className="gb-count">
          {text.length}/{LIMITS.text}
        </small>
      </label>
      <label>
        <span>{t('Your name (optional)', 'आपका नाम (ज़रूरी नहीं)')}</span>
        <input value={name} maxLength={LIMITS.name} placeholder={t('Anonymous', 'गुमनाम')} onChange={(e) => setName(e.target.value)} />
      </label>
      <input
        className="gb-trap"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        name="website"
      />
      <div className="gb-colors" role="radiogroup" aria-label="Note colour">
        {(Object.keys(NOTE_COLORS) as NoteColor[]).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            className={color === c ? 'on' : ''}
            style={{ background: NOTE_COLORS[c] }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <button className="cb-btn primary" disabled={state.busy || text.trim().length < 2}>
        {state.busy ? t('Pinning…', 'लगा रहे हैं…') : t('Pin it to the wall', 'दीवार पर लगाएँ')}
      </button>
      {state.msg && <p className={`gb-msg${state.ok ? ' ok' : ' bad'}`}>{state.msg}</p>}
      <p className="gb-fine">{t('Notes are public. No links, please, and be kind.', 'संदेश सबको दिखते हैं। कृपया लिंक न डालें, और प्यार से लिखें।')}</p>
    </form>
  )
}

function Sticky({ n, admin }: { n: Note; admin: boolean }) {
  return (
    <li className="gb-note" style={{ background: NOTE_COLORS[n.color], rotate: `${tilt(n.id)}deg` }}>
      <p>{n.text}</p>
      <small>
        — {n.name} · {ago(n.at)}
      </small>
      {admin && (
        <button className="gb-del" aria-label="Delete note" onClick={() => deleteNote(n.id)}>
          ×
        </button>
      )}
    </li>
  )
}

function Wall() {
  const { notes, status, admin } = useNotes()
  const t = useT()
  return (
    <div className="bk-flow page-text">
      <p className="bk-kicker">{t('From visitors', 'विज़िटर्स की ओर से')}</p>
      <h3>{t('The wall', 'दीवार')}</h3>
      {status === 'loading' && <p className="gb-msg">{t('Reading the notes…', 'संदेश पढ़ रहे हैं…')}</p>}
      {status === 'error' && <p className="gb-msg">{t('Couldn’t load the notes right now.', 'अभी संदेश लोड नहीं हो पाए।')}</p>}
      {status === 'ready' && notes.length === 0 && <p className="gb-msg">{t('No notes yet. Be the first!', 'अभी कोई संदेश नहीं है। पहले आप लिखिए!')}</p>}
      <ul className="gb-wall">
        {notes.map((n) => (
          <Sticky key={n.id} n={n} admin={Boolean(admin)} />
        ))}
      </ul>
    </div>
  )
}

export function GuestbookBook() {
  const single = singlePage()
  const t = useT()
  useEffect(() => {
    loadNotes() // fresh notes each time the book opens
  }, [])
  const write = (
    <div className="bk-flow page-text">
      <p className="bk-kicker">{t('Guestbook', 'गेस्टबुक')}</p>
      <h3>{t('Leave a note', 'एक संदेश छोड़िए')}</h3>
      <p className="bk-sub">
        {t(
          'It goes up on the wall next to my monitor, and the vine on my top shelf grows a new leaf for it.',
          'यह मेरे मॉनिटर के पास वाली दीवार पर लगेगा, और ऊपर वाली शेल्फ़ की बेल पर इसके लिए एक नई पत्ती उगेगी।',
        )}
      </p>
      <Write />
    </div>
  )
  return (
    <Book
      label="Guestbook"
      tint="mustard"
      cover={<Cover title="Guestbook" line="Leave a note on the wall" small="Sameer’s room" />}
      inside={write}
      page={
        single ? (
          <div className="gb-single">
            {write}
            <Wall />
          </div>
        ) : (
          <Wall />
        )
      }
    />
  )
}
