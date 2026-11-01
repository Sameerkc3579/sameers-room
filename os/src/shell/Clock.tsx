import { clockText, dateText, useNow } from './time'

/** The big time + date that sits on the wallpaper (and on the lock screen). */
export function BigClock({ className = '' }: { className?: string }) {
  const now = useNow()
  return (
    <div className={`big-clock ${className}`}>
      <div className="big-time">{clockText(now)}</div>
      <div className="big-date">{dateText(now)}</div>
    </div>
  )
}
