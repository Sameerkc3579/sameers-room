// The recruiter tour: one button (Overlay.tsx) and the camera walks through the room in about a minute, with a
// caption card for each stop (TourCard.tsx): who I am, SameerOS, projects, live stats, skills and resume, then how to
// reach me. Clicking anything in the room, Esc or the card's × ends it.
import { useScene } from './store'

export interface Stop {
  /** the object the camera visits (CameraRig.tsx), or null for the whole room */
  key: string | null
  /** how far the camera stands from it */
  dist?: number
  /** how far below it the camera aims (× dist), so it sits above the tour card */
  lift?: number
  /** how long the stop shows before the tour moves on; null waits for the visitor */
  ms: number | null
}

export const STOPS: Stop[] = [
  { key: null, ms: 8000 }, // hello
  { key: 'monitor', dist: 1.25, ms: 9000 },
  { key: 'books', dist: 0.95, ms: 13000 },
  { key: 'stats', dist: 1.45, lift: 0.07, ms: 11000 },
  { key: 'notebooks', dist: 1.0, ms: 11000 },
  { key: null, ms: null }, // let's talk
]

export function goTo(i: number) {
  const stop = STOPS[Math.max(0, Math.min(STOPS.length - 1, i))]
  useScene.setState({
    tour: STOPS.indexOf(stop),
    view: stop.key ? 'focus' : 'room',
    focus: stop.key,
    page: null,
    arrived: false,
    hover: null,
  })
}

export const startTour = () => goTo(0)

/** Ends the tour, back in the room unless `stay` (e.g. "open the resume" right where the camera already is). */
export function endTour(stay = false) {
  const s = useScene.getState()
  useScene.setState({ tour: null })
  if (!stay && s.view !== 'room') s.setView('room')
}

// going anywhere the tour didn't take you (clicking an object, Esc, clicking empty space) ends it
useScene.subscribe((s) => {
  if (s.tour === null) return
  const stop = STOPS[s.tour]
  if (s.view !== (stop.key ? 'focus' : 'room') || s.focus !== stop.key) useScene.setState({ tour: null })
})
