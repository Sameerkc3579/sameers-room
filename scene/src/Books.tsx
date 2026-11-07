import { useScene } from './store'
import { ResumeBook } from './ResumeBook'
import { AboutBook, ProjectsBook } from './InfoBooks'
import { GuestbookBook } from './Guestbook'
import { LetterBook } from './Letter'

/** Clicking the notebooks, the books under the riser, the quote print or the guestbook notes opens that content as
 * a book (Book.tsx). */
export function Books() {
  const key = useScene((s) => (s.view === 'focus' && s.arrived && s.tour === null ? s.focus : null)) // the tour only looks
  if (key === 'notebooks') return <ResumeBook />
  if (key === 'books') return <ProjectsBook />
  if (key === 'quote') return <AboutBook />
  if (key === 'guestbook') return <GuestbookBook />
  if (key === 'letter') return <LetterBook /> // the puzzle hunt's prize (hunt.ts)
  return null
}
