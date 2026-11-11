// "How it was built": the room takes itself apart, then builds itself again in the order it was really built, one
// commit at a time (the history of github.com/Sameerkc3579/sameers-room). BuildRig.tsx moves the 3D objects,
// BuildCard.tsx shows the commits and the controls, CameraRig.tsx frames each step. Anything that leaves the room
// (the tour, a book, the computer) ends it, and the room is whole again.
import { create } from 'zustand'
import { useScene } from './store'
import { endTour } from './tour'
import { whoosh } from './sound'
import { backToNow, useOutside } from './raipur'

export const REPO = 'https://github.com/Sameerkc3579/sameers-room'

export interface Commit {
  hash: string
  day: [string, string]
  title: string
}

const NOV = (d: number): [string, string] => [`Nov ${d}`, `${d} नवंबर`]

export const COMMITS: Commit[] = [
  { hash: 'b3f0aad', day: NOV(1), title: 'Blender pipeline for the sage desk nook' },
  { hash: '0ff78ec', day: NOV(1), title: 'SameerOS: a modern sage desktop' },
  { hash: 'fa7a788', day: NOV(1), title: 'SameerOS apps: projects, resume, terminal, lo-fi player, contact' },
  { hash: '6faf6c8', day: NOV(1), title: 'The 3D room in React Three Fiber' },
  { hash: '4ba62fc', day: NOV(1), title: 'Glowing hint dots on everything you can use' },
  { hash: 'd59ab85', day: NOV(2), title: 'Enter the computer: SameerOS grows out of the monitor' },
  { hash: '2991090', day: NOV(2), title: 'Deploy bundle for Vercel' },
  { hash: 'a40f995', day: NOV(7), title: 'Resume, projects and about me open as books' },
  { hash: 'f1380d3', day: NOV(7), title: "The room follows Raipur's time and weather" },
  { hash: '250f907', day: NOV(7), title: 'Live coding stats on the pegboard' },
  { hash: '916819a', day: NOV(7), title: 'Guestbook on Upstash Redis' },
  { hash: 'c4950bb', day: NOV(8), title: 'Ask Sameer: a keyless chat bot that moves the room' },
  { hash: '6f77f7f', day: NOV(8), title: 'Guestbook vine: a leaf for every note' },
  { hash: 'd0afa84', day: NOV(8), title: 'A puzzle hunt across the room' },
  { hash: 'fe9a96e', day: NOV(8), title: '60-second recruiter tour' },
  { hash: 'f59ae3f', day: NOV(8), title: 'Fireflies: other visitors, live' },
  { hash: 'c4c13c8', day: NOV(8), title: 'Lights off: the blinds close and the cursor becomes a torch' },
  { hash: 'dedf00d', day: NOV(8), title: 'Hindi switch for the room' },
  { hash: 'f8400cb', day: NOV(8), title: 'Break my agent: a prompt-injection game in SameerOS' },
  { hash: '2ac1b96', day: NOV(8), title: "Injection detector running on the visitor's device" },
  { hash: '9659ea9', day: NOV(8), title: 'Phones: lighter rendering and swipe to look around' },
  { hash: 'e30a577', day: NOV(8), title: 'Phones: taps that never get lost' },
  { hash: 'a4d983a', day: NOV(9), title: 'One bottom dock, labels kept on screen, faster transitions' },
  { hash: '7163748', day: NOV(9), title: 'README' },
  { hash: '03cf519', day: NOV(9), title: 'Deploy from GitHub: Vercel builds the room from the repo' },
  { hash: 'e9af740', day: NOV(10), title: 'Watch the room build itself' },
  { hash: 'de3aa5e', day: NOV(10), title: 'Room sounds' },
  // the newest commit: its own hash can't be written inside it
  { hash: 'HEAD', day: NOV(11), title: 'Turn the desk clock to any hour and weather' },
]

/** what appears (or happens) on a beat; the first five are the Blender room going up, piece by piece */
export type Piece =
  | 'shell'
  | 'window'
  | 'furniture'
  | 'setup'
  | 'decor'
  | 'screen'
  | 'fixtures'
  | 'hints'
  | 'books'
  | 'raipur'
  | 'stats'
  | 'guestbook'
  | 'vine'
  | 'hunt'
  | 'fireflies'
  | 'dark'
  | 'clock'

/** where the camera looks during a beat (CameraRig.tsx) */
export type Look = 'wide' | 'screen' | 'computer' | 'books' | 'window' | 'stats' | 'guestbook' | 'shelf' | 'note'

export interface Beat {
  /** indexes into COMMITS */
  commits: number[]
  piece?: Piece
  /** a short line under the commit: what's going up, or what the commit did */
  line?: [string, string]
  look?: Look
  ms: number
}

export const BEATS: Beat[] = [
  { commits: [0], piece: 'shell', line: ['Walls and floor', 'दीवारें और फ़र्श'], ms: 1500 },
  { commits: [0], piece: 'window', look: 'window', line: ['The window and its blinds', 'खिड़की और उसके ब्लाइंड्स'], ms: 1400 },
  { commits: [0], piece: 'furniture', line: ['Desk, chair and shelves', 'डेस्क, कुर्सी और शेल्फ़'], ms: 1700 },
  { commits: [0], piece: 'setup', line: ['The desk setup', 'डेस्क का सामान'], ms: 1900 },
  { commits: [0], piece: 'decor', line: ['Plants, prints and candles', 'पौधे, तस्वीरें और मोमबत्तियाँ'], ms: 2100 },
  { commits: [1, 2], piece: 'screen', look: 'screen', line: ['A desktop of my own, written in React', 'React में लिखा मेरा अपना डेस्कटॉप'], ms: 2400 },
  { commits: [3], piece: 'fixtures', line: ['Lights on', 'लाइटें जलीं'], ms: 1900 },
  { commits: [4], piece: 'hints', ms: 1700 },
  { commits: [5], look: 'computer', ms: 2000 },
  { commits: [6], line: ['sameers-room.vercel.app goes live', 'sameers-room.vercel.app लाइव हुआ'], ms: 1600 },
  { commits: [7], piece: 'books', look: 'books', ms: 1900 },
  { commits: [8], piece: 'raipur', look: 'window', line: ['Daylight, dusk and rain, as it is in Raipur right now', 'दिन, शाम और बारिश, जैसा अभी रायपुर में है'], ms: 2200 },
  { commits: [9], piece: 'stats', look: 'stats', ms: 1900 },
  { commits: [10], piece: 'guestbook', look: 'guestbook', ms: 1800 },
  { commits: [11], line: ['Try “turn the lights off” in the chat', 'चैट में लिखकर देखें “turn the lights off”'], ms: 1900 },
  { commits: [12], piece: 'vine', look: 'shelf', ms: 2400 },
  { commits: [13], piece: 'hunt', look: 'note', line: ['No spoilers', 'कोई स्पॉइलर नहीं'], ms: 1700 },
  { commits: [14], ms: 1500 },
  { commits: [15], piece: 'fireflies', line: ['Each firefly is someone else in the room right now', 'हर जुगनू कोई और विज़िटर है, अभी इसी कमरे में'], ms: 1900 },
  { commits: [16], piece: 'dark', ms: 2800 },
  { commits: [17], line: ['हिंदी में भी', 'हिंदी में भी'], ms: 1500 },
  { commits: [18, 19], line: ['Both run inside SameerOS', 'दोनों SameerOS के अंदर चलते हैं'], ms: 2300 },
  { commits: [20, 21], line: ['Swipe to look around, and every animation kept', 'घूमने के लिए स्वाइप करें, और हर एनिमेशन वैसा ही'], ms: 2300 },
  { commits: [22, 23], ms: 2000 },
  { commits: [24], line: ['Every push now deploys itself', 'अब हर push अपने आप लाइव होता है'], ms: 1700 },
  { commits: [25], line: ["You're watching it", 'आप इसे अभी देख रहे हैं'], ms: 1700 },
  { commits: [26], line: ['Rain, birds, crickets and candles, all made in code', 'बारिश, चिड़ियाँ, झींगुर और मोमबत्तियाँ, सब कोड से बनी'], ms: 1900 },
  { commits: [27], piece: 'clock', line: ['A whole day goes by, and back to Raipur right now', 'पूरा एक दिन बीतता है, और फिर अभी का रायपुर'], ms: 3600 },
]

/** the room comes apart first (decor first, walls last) */
export const TEARDOWN = 1100
/** when each beat starts, ms into the replay */
export const START: number[] = []
let sum = TEARDOWN
for (const b of BEATS) {
  START.push(sum)
  sum += b.ms
}
export const TOTAL = sum
/** the closing card: the room is whole again */
export const END = BEATS.length
export const PIECE_AT = Object.fromEntries(BEATS.flatMap((b, i) => (b.piece ? [[b.piece, i]] : []))) as Record<Piece, number>

/** the replay's own clock in ms (BuildRig advances it unless paused; seeking sets it) */
export const clock = { ms: 0 }

interface BuildState {
  /** the beat showing: -1 while the room comes apart, END for the closing card, null when there's no replay */
  at: number | null
  paused: boolean
}
export const useBuild = create<BuildState>(() => ({ at: null, paused: false }))

/** has this piece of the room been built yet? (always, outside the replay) */
export const reached = (s: BuildState, p: Piece) => s.at === null || s.at >= PIECE_AT[p]
export const building = () => useBuild.getState().at !== null

export function startBuild() {
  const s = useScene.getState()
  if (s.tour !== null) endTour(true)
  if (s.view !== 'room') s.setView('room')
  if (!s.lightsOn) s.toggleLights()
  s.setHover(null)
  backToNow() // the room as it is in Raipur (the desk clock's commit turns it through a day, then back)
  clock.ms = 0
  whoosh()
  useBuild.setState({ at: -1, paused: false })
}

/** jump to a beat (-1 replays from the start, END finishes the room) */
export function seek(i: number) {
  const at = Math.max(-1, Math.min(END, i))
  clock.ms = at < 0 ? 0 : at >= END ? TOTAL : START[at]
  useBuild.setState({ at })
}

export const stopBuild = () => useBuild.setState({ at: null, paused: false })

// the lights-off commit really switches them off for its beat (blinds, torch and all), and back on after
let darkened = false
useBuild.subscribe((b) => {
  const dark = b.at === PIECE_AT.dark
  if (dark === darkened) return
  darkened = dark
  const s = useScene.getState()
  if (s.lightsOn === dark) s.toggleLights()
})

// the desk clock's commit runs the room through a whole day (BuildRig.tsx), back to Raipur's time when it ends
let turning = false
useBuild.subscribe((b) => {
  const on = b.at === PIECE_AT.clock
  if (on === turning) return
  turning = on
  if (!on && useOutside.getState().pick.hour !== null) backToNow()
})

// going anywhere else (the tour, a book or the computer, from the chat) ends the replay
useScene.subscribe((s) => {
  if (useBuild.getState().at !== null && (s.view !== 'room' || s.tour !== null)) stopBuild()
})
