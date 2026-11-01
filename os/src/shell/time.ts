import { useEffect, useState } from 'react'

export function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** "07:24": 12-hour, zero-padded, no AM/PM, like the desk clock in the room. */
export const clockText = (d: Date) =>
  `${String(d.getHours() % 12 || 12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export const dateText = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
