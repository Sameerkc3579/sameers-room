import { useEffect, useRef, useState } from 'react'
import { useOS, type Win } from '../store'
import { profile, GITHUB, LINKEDIN, EMAIL } from '../content/profile'
import { allProjects } from '../content/projects'
import { openProject, unlock } from '../bridge'

const PROMPT = 'sameer@sameeros:~$ '

const BANNER = [
  'SameerOS Terminal · version 2026.11',
  'No rights reserved, just borrowed from coffee.',
  '',
  "Type 'help' to see what you can do.",
  '',
]

const LOGO = [
  '   .--------.   ',
  '  /  .----.  \\  ',
  '  |  \\___    |  ',
  '  \\      \\   /  ',
  "   '----.  \\'   ",
  '  .______)  |   ',
  "   '-------'    ",
]

function neofetch() {
  const info = [
    `sameer@SAMEER-PC`,
    `----------------`,
    `OS: SameerOS Portfolio Edition`,
    `Host: IIIT Naya Raipur`,
    `Uptime: B.Tech DS & AI, 2024 – 2028`,
    `CGPA: ${profile.education.cgpa}`,
    `Shell: Python, C++, TypeScript`,
    `GPU: rented A100s, mostly`,
    `Focus: LLM agents, red-teaming, NLP, CV`,
    `DSA: 700+ problems solved`,
  ]
  return Array.from({ length: Math.max(LOGO.length, info.length) }, (_, i) =>
    (LOGO[i] ?? ' '.repeat(16)) + '  ' + (info[i] ?? ''),
  )
}

export function Terminal({ win }: { win: Win }) {
  const [lines, setLines] = useState<string[]>(BANNER)
  const [input, setInput] = useState('')
  const [hist, setHist] = useState<string[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const { open, close } = useOS.getState()
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lines])

  const run = (raw: string): string[] | null => {
    const [cmd, ...args] = raw.trim().split(/\s+/)
    const arg = args.join(' ').toLowerCase()
    switch ((cmd ?? '').toLowerCase()) {
      case '':
        return []
      case 'help':
        return [
          'whoami          who is this guy',
          'ls projects     list projects (also: dir)',
          'cat <project>   details, e.g. cat sentinel',
          'open <project>  open the project window',
          'skills          installed skills',
          'education       degree and coursework',
          'contact         how to reach me',
          'resume          open my resume',
          'neofetch        system info',
          'music           toggle the lo-fi player',
          'breakme         try to break my AI assistant',
          'guard           run a real injection detector in your browser',
          'cls / clear     clear the screen',
          'exit            close this window',
        ]
      case 'guard':
      case 'detect':
        open('guard')
        return ['Opening Injection detector. The model runs on your device.']
      case 'breakme':
      case 'hack':
        open('agent')
        return ['Opening Break my agent. Get the Wi-Fi password out of my assistant.']
      case 'whoami':
        return [`${profile.name} (${profile.role})`, '', ...profile.bio]
      case 'ls':
      case 'dir':
        // the puzzle hunt (scene/src/hunt.ts): a hidden file for whoever reads the sticky note on the monitor
        if (/^-\w*a|^\/a/.test(arg))
          return [
            '~',
            '',
            '  .hunt            a note for whoever finds it',
            '  projects/        (ls projects)',
            '  Resume.pdf       (resume)',
          ]
        return [
          '~/projects',
          '',
          ...allProjects.map(
            (p) => `  ${p.id.padEnd(16)} ${(p.metric?.value ?? '').padEnd(16)} ${p.tagline}`,
          ),
        ]
      case 'cat':
      case 'type':
      case 'open': {
        if (arg.replace(/^~\//, '') === '.hunt' && cmd.toLowerCase() !== 'open')
          return [
            'So you read the note on my monitor. Good eyes.',
            '',
            "There's a letter hidden in this room. Three clues lead to it,",
            'and the last one gives you a word. Then come back and type:',
            '',
            '  unlock <word>',
            '',
            'Clue 1: someone pencilled a note in the margin of the book about me.',
          ]
        const p = allProjects.find((x) => x.id === arg || x.name.toLowerCase() === arg)
        if (!p) return [`File not found: '${arg}'. Try 'ls projects'.`]
        if (cmd.toLowerCase() === 'open') {
          openProject(p.id)
          return [`Opening ${p.name}...`]
        }
        return [
          `== ${p.name} == ${p.tagline}`,
          ...(p.metric ? [`>> ${p.metric.value}: ${p.metric.label}`] : []),
          `stack: ${p.stack.join(', ')}`,
          ...p.bullets.map((b) => `- ${b}`),
          `github: ${p.github}`,
        ]
      }
      case 'skills':
        return Object.entries(profile.skills).map(([k, v]) => `${k.padEnd(16)} ${v.join(', ')}`)
      case 'education':
        return [
          profile.education.school,
          `${profile.education.degree}, ${profile.education.period}`,
          `CGPA ${profile.education.cgpa}`,
          '',
          ...Object.entries(profile.coursework).map(([k, v]) => `${k}: ${v.join(', ')}`),
        ]
      case 'contact':
        return [`email     ${EMAIL}`, `github    ${GITHUB}`, `linkedin  ${LINKEDIN}`]
      case 'resume':
        open('resume')
        return ['Opening Resume.pdf...']
      case 'music':
        open('music')
        return ['Opening Lo-fi Player...']
      case 'neofetch':
        return neofetch()
      case 'sudo':
        if (arg.startsWith('hire')) {
          open('contact')
          return ['[sudo] password for recruiter: ********', 'Access granted. Opening a new message to Sameer...']
        }
        return ['sudo: permission denied. Nice try.']
      case 'unlock':
        if (!arg) return ['Usage: unlock <word>']
        unlock(arg).then((ok) =>
          setLines((l) => [
            ...l,
            ...(ok === null
              ? ["The letter is hidden in the 3D room, so this only works there. Open the room and try again."]
              : ok
                ? ['*click*  That’s the word.', 'Something opens in the room...', '']
                : ['Nope, that’s not it. The clues are in the room.', '']),
          ]),
        )
        return ['Checking with the room...']
      case 'cls':
      case 'clear':
        return null
      case 'exit':
        close(win.id)
        return []
      case 'rm':
        return ['rm: permission denied. Files go in the Recycle Bin around here.']
      default:
        return [`${cmd}: command not found`, "Type 'help' for a list."]
    }
  }

  const submit = () => {
    const out = run(input)
    setLines((l) => (out === null ? [] : [...l, PROMPT + input, ...out, '']))
    if (input.trim()) setHist((h) => [input, ...h])
    setHIdx(-1)
    setInput('')
  }

  return (
    <div className="window-body flush terminal" onClick={() => inputRef.current?.focus()}>
      <pre>
        {lines.join('\n')}
        {lines.length ? '\n' : ''}
        <span className="term-line">
          {PROMPT}
          <input
            ref={inputRef}
            autoFocus
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              else if (e.key === 'ArrowUp' && hist.length) {
                const i = Math.min(hIdx + 1, hist.length - 1)
                setHIdx(i)
                setInput(hist[i])
                e.preventDefault()
              } else if (e.key === 'ArrowDown') {
                const i = hIdx - 1
                setHIdx(Math.max(i, -1))
                setInput(i >= 0 ? hist[i] : '')
                e.preventDefault()
              }
            }}
          />
        </span>
        <div ref={endRef} />
      </pre>
    </div>
  )
}
