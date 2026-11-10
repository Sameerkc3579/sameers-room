import { useEffect, useState } from 'react'
import { BOOKS, useScene } from './store'
import { useSwipeHint } from './pan'
import { sendOS } from './osLink'
import { clockText, doing, skyText, useOutside } from './raipur'
import { solvedText, useStats } from './live'
import { startTour } from './tour'
import { usePresence } from './presence'
import { toggleLang, useLang, useT } from './i18n'
import { useChat } from './agent'
import { reached, startBuild, useBuild } from './build'
import { toggleSound, useSound } from './sound'

const RESUME = './os/resume.pdf'
const OS_2D = './os/index.html'
const AVATAR = './os/avatar.svg'
const CAPTION_MS = 15000

/** In the bottom dock while music plays: what's on, and a tap pauses it. */
function NowPlaying() {
  const music = useScene((s) => s.music)
  const t = useT()
  if (!music.playing) return null
  return (
    <button className="dock-music" onClick={() => sendOS({ type: 'os:music', action: 'toggle' })} title={t('Pause', 'रोकें')}>
      <span className="eq" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="dock-music-name">lo-fi · {music.track}</span> <span className="pause">❚❚</span>
    </button>
  )
}

/** Top-left in the room: what time and weather it is in Raipur right now, what Sameer is probably doing, and how
 * many other visitors are here (Fireflies.tsx). */
function RaipurChip() {
  const inRoom = useScene((s) => s.view === 'room')
  const built = useBuild((s) => reached(s, 'raipur')) // the replay (build.ts) brings it with its commit
  const { hour, weekday, sky, temp, day, golden } = useOutside()
  const others = usePresence((s) => s.others.length)
  const t = useT()
  return (
    <div className={`raipur${inRoom && built ? '' : ' hidden'}`} aria-live="off">
      <p className="raipur-now">
        <span className="raipur-dot" aria-hidden />
        {t('Raipur', 'रायपुर')} · {clockText(hour)} · {temp !== null && `${temp}°C, `}
        {skyText(sky, day, golden, hour)}
      </p>
      <p className="raipur-doing">{doing(hour, weekday)}</p>
      {others > 0 && (
        <p
          className="raipur-others"
          title={t(
            "Each firefly in the room is another visitor. Hover over one to see what they're doing.",
            'कमरे का हर जुगनू एक और विज़िटर है। वे क्या कर रहे हैं, यह देखने के लिए किसी जुगनू पर होवर करें।',
          )}
        >
          <span aria-hidden>✦</span>{' '}
          {t(
            `${others === 1 ? '1 other visitor is' : `${others} other visitors are`} here now, as fireflies`,
            `अभी ${others} और विज़िटर यहाँ ${others === 1 ? 'है' : 'हैं'}, जुगनू बनकर`,
          )}
        </p>
      )}
    </div>
  )
}

/** Under the stats close-up: the same numbers as text, with links to each profile. */
function StatsCaption() {
  const shown = useScene((s) => s.view === 'focus' && s.focus === 'stats' && s.arrived && s.tour === null)
  const stats = useStats((s) => s.stats)
  const hi = useLang((s) => s.lang === 'hi')
  const t = useT()
  if (!shown) return null
  const lc = stats?.leetcode
  const cf = stats?.codeforces
  const gh = stats?.github
  return (
    <div className="stats-caption">
      <p>
        {stats ? (
          hi ? (
            <>
              अलग-अलग साइट्स पर <b>{solvedText(stats)}</b> सवाल हल किए · इस साल <b>{gh?.total ?? '–'}</b> GitHub योगदान
            </>
          ) : (
            <>
              <b>{solvedText(stats)}</b> problems solved across sites · <b>{gh?.total ?? '–'}</b> GitHub contributions this year
            </>
          )
        ) : (
          t('Fetching the latest numbers…', 'ताज़ा आँकड़े आ रहे हैं…')
        )}
      </p>
      <div className="stats-links">
        <a href={`https://leetcode.com/u/${lc?.user ?? 'im__sameer'}/`} target="_blank" rel="noreferrer">
          LeetCode {lc ? `· ${lc.solved}` : ''} ↗
        </a>
        <a href={`https://codeforces.com/profile/${cf?.user ?? 'sameer24102'}`} target="_blank" rel="noreferrer">
          Codeforces {cf ? `· ${cf.solved}` : ''} ↗
        </a>
        <a href={`https://github.com/${gh?.user ?? 'Sameerkc3579'}`} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </div>
      {stats && <small>{t('Live numbers, refreshed every few hours.', 'लाइव आँकड़े, हर कुछ घंटों में अपडेट होते हैं।')}</small>}
    </div>
  )
}

/** Portrait phones see part of the room: say that it swipes, while the camera glances over (CameraRig.tsx). */
function SwipeHint() {
  const show = useSwipeHint((s) => s.show)
  const inRoom = useScene((s) => s.view === 'room' && s.tour === null)
  const replay = useBuild((s) => s.at !== null)
  const t = useT()
  if (!show || !inRoom || replay) return null
  return <p className="torch-hint">↔ {t('Swipe to look around the room', 'कमरा देखने के लिए दाएँ-बाएँ स्वाइप करें')}</p>
}

export function Overlay() {
  const view = useScene((s) => s.view)
  const book = useScene((s) => s.view === 'focus' && BOOKS.includes(s.focus ?? '')) // books have their own Close
  const touring = useScene((s) => s.tour !== null) // the tour card has its own controls
  const replay = useBuild((s) => s.at !== null) // so does the "how it was built" replay (BuildCard.tsx)
  const setView = useScene((s) => s.setView)
  const lang = useLang((s) => s.lang)
  const sound = useSound((s) => s.on)
  const t = useT()
  const chat = useChat()
  // the dock's "click the dots" line shows for a while once the room is drawn, then goes
  const shown = useScene((s) => s.shown)
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setIntro(false), CAPTION_MS)
    return () => clearTimeout(timer)
  }, [shown])
  // phones place the chat button by view (styles.css)
  useEffect(() => {
    document.body.dataset.view = view
  }, [view])
  return (
    <>
      <SwipeHint />
      <RaipurChip />
      <StatsCaption />
      {view !== 'room' && !book && !touring && (
        <button className={`back${view === 'screen' ? ' over-os' : ''}`} onClick={() => setView('room')}>
          {t('← Back to room', '← कमरे में वापस')}
        </button>
      )}
      {/* everything that isn't part of the room, in one dock at the bottom */}
      <nav className={`dock${view !== 'room' || touring || replay ? ' hidden' : ''}`} aria-label={t('Menu', 'मेन्यू')}>
        {intro && shown && <p className="dock-caption">{t('Click the glowing dots to explore', 'घूमने के लिए चमकते बिंदुओं पर क्लिक करें')}</p>}
        <button className={`dock-ask${chat.open ? ' on' : ''}`} onClick={() => chat.setOpen(!chat.open)}>
          <img src={AVATAR} alt="" />
          <span className="dock-ask-text">
            {t('Ask ', '')}
            <b>Sameer</b>
            {t('', ' से पूछें')}
          </span>
          <span className="dock-ask-short">{t('Ask', 'पूछें')}</span>
          {chat.messages.length > 1 && !chat.open && <i className="chat-unread" aria-hidden />}
        </button>
        <button className="dock-tour" onClick={startTour}>
          <span>
            <span className="tour-full">{t('Hiring? ', 'भर्ती कर रहे हैं? ')}</span>
            <span className="tour-long">{t('60-sec tour', '60 सेकंड का टूर')}</span>
            <span className="tour-short">{t('Tour', 'टूर')}</span>
          </span>
        </button>
        <button className="dock-build" onClick={startBuild} title={t('Watch the room build itself, commit by commit', 'कमरे को कमिट-दर-कमिट बनते हुए देखें')}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M10 7l4-4 7 7-4 4z" />
            <path d="M13.5 10.5 4 20" />
          </svg>
          <span className="dock-build-text">{t('How it was built', 'कैसे बना')}</span>
        </button>
        <NowPlaying />
        <span className="dock-sep" aria-hidden />
        <a href={RESUME} download="Sameer_Choudhary_Resume.pdf">
          {t('Resume ↓', 'रिज़्यूमे ↓')}
        </a>
        <a href={OS_2D}>
          <span>
            2D<span className="dock-long">{t(' version', ' वर्ज़न')}</span>
          </span>
        </a>
        <button
          className={`dock-sound${sound ? '' : ' off'}`}
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={t('Room sounds', 'कमरे की आवाज़ें')}
          title={sound ? t('Turn the sound off', 'आवाज़ बंद करें') : t('Turn the sound on', 'आवाज़ चालू करें')}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
            {sound ? (
              <>
                <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
                <path d="M18 7a7 7 0 0 1 0 10" />
              </>
            ) : (
              <path d="M16 10l4 4M20 10l-4 4" />
            )}
          </svg>
        </button>
        <button className="dock-lang" onClick={toggleLang} lang={lang === 'en' ? 'hi' : 'en'} title={t('हिंदी में देखें', 'View in English')}>
          <span className="lang-full">{lang === 'en' ? 'हिंदी' : 'English'}</span>
          <span className="lang-short" aria-hidden>
            {lang === 'en' ? 'हि' : 'EN'}
          </span>
        </button>
      </nav>
    </>
  )
}
