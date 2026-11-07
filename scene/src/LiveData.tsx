import { useEffect } from 'react'
import { loadNotes, loadStats, useNotes, useStats } from './live'
import { drawNotes, drawStats } from './pinned'
import { startOutside } from './raipur'
import { startPresence } from './presence'

/** Starts the live parts of the room: Raipur's clock and weather, the coding stats, the guestbook notes and who
 * else is here,
 * and keeps the papers pinned up in the room (pinned.ts) drawn with the latest of each. */
export function LiveData() {
  const stats = useStats((s) => s.stats)
  const notes = useNotes((s) => s.notes)
  useEffect(() => {
    startOutside()
    loadStats()
    loadNotes()
    startPresence()
  }, [])
  useEffect(() => drawStats(stats), [stats])
  useEffect(() => drawNotes(notes), [notes])
  return null
}
