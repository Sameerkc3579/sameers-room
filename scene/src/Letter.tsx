// The end of the puzzle hunt (hunt.ts): a letter from Sameer on the left page, the hall of solvers on the right.
// It opens when the right word is typed into the terminal (`unlock <word>`), and again any time after that.
import { useEffect, useState, type FormEvent } from 'react'
import { Book, Cover } from './Book'
import { singlePage } from './store'
import { EMAIL } from '../../os/src/content/profile'
import { loadHall, signHall, useHunt } from './hunt'

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const nth = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`

function Letter() {
  return (
    <div className="bk-flow page-text letter">
      <p className="bk-kicker">You found it</p>
      <h3>A letter for you</h3>
      <p>Hey,</p>
      <p>
        most people look around this room for a minute and move on. You read a note on my monitor, dug through my
        terminal, cracked a cipher in a margin and sat in the dark counting letters. That’s the kind of curiosity I
        like building things with.
      </p>
      <p>
        This room grows a little with everyone who visits. The vine on my top shelf gets a leaf for every guestbook
        note, and the hall on the next page keeps the names of everyone who made it this far. Add yours.
      </p>
      <p>
        And if you ever want to build something together, write to me at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Tell me
        you found the letter.
      </p>
      <p className="letter-sign">— Sameer</p>
    </div>
  )
}

function Sign() {
  const rank = useHunt((s) => s.rank)
  const status = useHunt((s) => s.hall.status)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('') // honeypot: hidden from people, bots fill it in
  const [state, setState] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null })

  if (rank) return <p className="gb-msg ok">You’re the {nth(rank)} person to solve it. Your name is in the hall.</p>
  if (status === 'offline') return <p className="gb-msg">The hall opens soon. Your letter stays unlocked in this browser.</p>

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state.busy || name.trim().length < 2) return
    setState({ busy: true, msg: null })
    setState({ busy: false, msg: await signHall(name, website) })
  }
  return (
    <form className="gb-form hunt-sign" onSubmit={submit}>
      <label>
        <span>Your name</span>
        <input value={name} maxLength={24} placeholder="How the hall should remember you" onChange={(e) => setName(e.target.value)} required />
      </label>
      <input className="gb-trap" tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
      <button className="cb-btn primary" disabled={state.busy || name.trim().length < 2}>
        {state.busy ? 'Signing…' : 'Sign the hall'}
      </button>
      {state.msg && <p className="gb-msg bad">{state.msg}</p>}
    </form>
  )
}

function Hall() {
  const { solvers, total, status } = useHunt((s) => s.hall)
  return (
    <div className="bk-flow page-text">
      <p className="bk-kicker">Hall of solvers</p>
      <h3>{total ? `${total} ${total === 1 ? 'person has' : 'people have'} found it` : 'Be the first name here'}</h3>
      <Sign />
      {status === 'loading' && <p className="gb-msg">Reading the hall…</p>}
      {status === 'error' && <p className="gb-msg">Couldn’t load the hall right now.</p>}
      <ol className="hall">
        {solvers.map((s, i) => (
          <li key={`${s.at}${i}`}>
            <span className="hall-no">{i + 1}</span>
            <b>{s.name}</b>
            <small>{day(s.at)}</small>
          </li>
        ))}
      </ol>
      <p className="gb-fine">Please don’t spoil the answer for others.</p>
    </div>
  )
}

export function LetterBook() {
  const single = singlePage()
  useEffect(() => {
    loadHall()
  }, [])
  return (
    <Book
      label="Hidden letter"
      tint="forest"
      cover={<Cover title="For the curious" line="You solved the room" small="A letter from Sameer" />}
      inside={<Letter />}
      page={
        single ? (
          <div className="gb-single">
            <Letter />
            <Hall />
          </div>
        ) : (
          <Hall />
        )
      }
    />
  )
}
