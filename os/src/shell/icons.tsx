// SameerOS icons: rounded app tiles in a sage/clay palette with simple white glyphs (all original SVG).
import type { ReactNode } from 'react'

export type IconName =
  | 'computer' | 'folder' | 'folder-docs' | 'doc' | 'pdf' | 'cmd' | 'mail' | 'music'
  | 'recycle' | 'recycle-full' | 'info' | 'warning' | 'error' | 'power' | 'logoff'
  | 'restart' | 'standby' | 'link' | 'help' | 'logo' | 'speaker' | 'mute'
  | 'search' | 'back' | 'forward' | 'github' | 'linkedin' | 'shield' | 'scan'

const TILES: Record<string, [string, string]> = {
  computer: ['#5c7a52', '#2f4a2c'],
  folder: ['#9db88f', '#5f7f56'],
  'folder-docs': ['#9db88f', '#5f7f56'],
  pdf: ['#df9a7a', '#b8634a'],
  cmd: ['#4a5246', '#1d221b'],
  mail: ['#a9c3c4', '#5f8587'],
  music: ['#eab0a0', '#c47466'],
  recycle: ['#c3cabf', '#8a9386'],
  'recycle-full': ['#c3cabf', '#8a9386'],
  link: ['#a7bfae', '#557563'],
  github: ['#4a5246', '#1d221b'],
  linkedin: ['#8fb0c4', '#4f7590'],
  logo: ['#a6c196', '#4f6b47'],
  shield: ['#d9a35c', '#a8692f'],
  scan: ['#8fb7a8', '#3f7564'],
}

export function IconDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {Object.entries(TILES).map(([k, [a, b]]) => (
          <linearGradient key={k} id={`t-${k}`} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        ))}
        <linearGradient id="t-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const W = { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const tile = (name: string, glyph: ReactNode) => (
  <>
    <rect x="1" y="1" width="30" height="30" rx="8" fill={`url(#t-${name})`} />
    <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#t-shine)" />
    {glyph}
  </>
)

const leaf = (
  <>
    <path d="M9 23c0-9 6-14 15-14 0 9-5 15-14 15" fill="#fff" fillOpacity=".95" />
    <path d="M10 23l9-9" stroke="#4f6b47" strokeWidth="1.6" strokeLinecap="round" />
  </>
)

const circle = (color: string, glyph: ReactNode) => (
  <>
    <circle cx="16" cy="16" r="14" fill={color} />
    {glyph}
  </>
)

const ICONS: Record<IconName, ReactNode> = {
  computer: tile('computer', (
    <>
      <circle cx="16" cy="12.5" r="4.2" {...W} />
      <path d="M8.5 24.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6" {...W} />
    </>
  )),
  folder: tile('folder', <path d="M7 11.5V22a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 25 22v-8a1.5 1.5 0 0 0-1.5-1.5H16l-2-2.5H8.5A1.5 1.5 0 0 0 7 11.5z" {...W} />),
  'folder-docs': tile('folder-docs', (
    <>
      <path d="M7 11.5V22a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 25 22v-8a1.5 1.5 0 0 0-1.5-1.5H16l-2-2.5H8.5A1.5 1.5 0 0 0 7 11.5z" {...W} />
      <path d="M12 18h8" {...W} />
    </>
  )),
  doc: (
    <>
      <path d="M8 3h11l6 6v19a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#fbfaf6" stroke="#b7c4ae" />
      <path d="M19 3v6h6" fill="#e7eee1" stroke="#b7c4ae" />
      <path d="M11 15h10M11 19h10M11 23h7" stroke="#7d9a72" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  pdf: tile('pdf', (
    <>
      <path d="M11 7h7l4 4v13a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" {...W} />
      <path d="M13 17h6M13 21h4" {...W} />
    </>
  )),
  cmd: tile('cmd', (
    <>
      <path d="M9 12l4 4-4 4" {...W} stroke="#b9d6a8" />
      <path d="M15 21h8" {...W} />
    </>
  )),
  mail: tile('mail', (
    <>
      <rect x="7" y="10" width="18" height="13" rx="2" {...W} />
      <path d="M7.5 11l8.5 6.5 8.5-6.5" {...W} />
    </>
  )),
  music: tile('music', (
    <>
      <path d="M13 21V9.5l10-2V19" {...W} />
      <circle cx="11" cy="21.5" r="2.5" fill="#fff" />
      <circle cx="21" cy="19.5" r="2.5" fill="#fff" />
    </>
  )),
  recycle: tile('recycle', (
    <>
      <path d="M10 11h12M14 11V9h4v2M11.5 11l1 13h7l1-13" {...W} />
    </>
  )),
  'recycle-full': tile('recycle-full', (
    <>
      <path d="M10 11h12M14 11V9h4v2M11.5 11l1 13h7l1-13" {...W} />
      <path d="M14.5 15v6M17.5 15v6" {...W} strokeWidth={1.5} />
    </>
  )),
  link: tile('link', (
    <>
      <circle cx="16" cy="16" r="8" {...W} />
      <path d="M8 16h16M16 8c3 3 3 13 0 16M16 8c-3 3-3 13 0 16" {...W} strokeWidth={1.5} />
    </>
  )),
  github: tile('github', (
    <path d="M16 7.5a8.5 8.5 0 0 0-2.7 16.6c.4 0 .6-.2.6-.4v-1.6c-2.4.5-2.9-1-2.9-1-.4-1-1-1.3-1-1.3-.8-.5 0-.5 0-.5.9 0 1.3.9 1.3.9.8 1.3 2 1 2.6.7 0-.6.3-1 .6-1.2-1.9-.2-3.9-1-3.9-4.2 0-.9.3-1.7.9-2.3-.1-.2-.4-1.1.1-2.3 0 0 .7-.2 2.3.9a8 8 0 0 1 4.2 0c1.6-1.1 2.3-.9 2.3-.9.5 1.2.2 2.1.1 2.3.5.6.9 1.4.9 2.3 0 3.3-2 4-3.9 4.2.3.3.6.8.6 1.6v2.4c0 .2.2.5.6.4A8.5 8.5 0 0 0 16 7.5z" fill="#fff" />
  )),
  linkedin: tile('linkedin', (
    <>
      <path d="M10.5 14v8M15 22v-8M15 17.5c0-2 1.3-3.5 3.2-3.5 1.9 0 2.8 1.3 2.8 3.4V22" {...W} />
      <circle cx="10.5" cy="10.5" r="1.3" fill="#fff" />
    </>
  )),
  shield: tile('shield', (
    <>
      <path d="M16 6.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" {...W} />
      <path d="M16.8 11.5l-2.6 4.6h3.6l-2.6 4.6" {...W} strokeWidth={1.8} />
    </>
  )),
  scan: tile('scan', (
    <>
      <path d="M8 12V9a1 1 0 0 1 1-1h3M20 8h3a1 1 0 0 1 1 1v3M24 20v3a1 1 0 0 1-1 1h-3M12 24H9a1 1 0 0 1-1-1v-3" {...W} />
      <path d="M11 16h10" {...W} strokeWidth={2.4} />
    </>
  )),
  logo: (
    <>
      <circle cx="16" cy="16" r="15" fill="url(#t-logo)" />
      {leaf}
    </>
  ),
  info: circle('#5f8f6b', (
    <>
      <circle cx="16" cy="10.5" r="1.7" fill="#fff" />
      <path d="M16 14.5v8" {...W} strokeWidth={2.6} />
    </>
  )),
  help: circle('#5f8f6b', <text x="16" y="21.5" fontSize="15" fontWeight="700" fill="#fff" textAnchor="middle" fontFamily="Segoe UI, Arial">?</text>),
  warning: circle('#d7a03c', (
    <>
      <path d="M16 9v8" {...W} strokeWidth={2.6} />
      <circle cx="16" cy="21.5" r="1.7" fill="#fff" />
    </>
  )),
  error: circle('#c45a4a', <path d="M11.5 11.5l9 9M20.5 11.5l-9 9" {...W} strokeWidth={2.6} />),
  power: circle('#c45a4a', (
    <>
      <path d="M11.8 11.5a6.5 6.5 0 1 0 8.4 0" {...W} />
      <path d="M16 8.5v7" {...W} />
    </>
  )),
  logoff: circle('#7d9a72', <path d="M10 16h11M17 12l4 4-4 4" {...W} />),
  restart: circle('#5f8f6b', <path d="M21.5 13a6.5 6.5 0 1 0 .5 5.5M22 8.5V13h-4.5" {...W} />),
  standby: circle('#a08a5c', <path d="M19 9.5a7 7 0 1 0 4 11.5 6 6 0 0 1-4-11.5z" fill="#fff" />),
  speaker: (
    <>
      <path d="M6 13h4l6-5v16l-6-5H6z" fill="currentColor" />
      <path d="M20 12a5.5 5.5 0 0 1 0 8M23 9a9.5 9.5 0 0 1 0 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  mute: (
    <>
      <path d="M6 13h4l6-5v16l-6-5H6z" fill="currentColor" />
      <path d="M20 13l6 6M26 13l-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  search: (
    <>
      <circle cx="14" cy="14" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M19.5 19.5L26 26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  back: <path d="M19 8l-8 8 8 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  forward: <path d="M13 8l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
}

export function Icon({ name, size = 32, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  )
}
