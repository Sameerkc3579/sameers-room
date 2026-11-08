// The chat's brain: answers questions about Sameer from his portfolio content (os/src/content, the live stats and
// Raipur's clock) and turns requests into things that happen in the room. No AI model, no server, no key: it
// matches the question against topics (tolerating typos and some Hinglish), remembers which project is being
// discussed so "tell me more" goes deeper, and never gives the same answer twice in a row.
import { profile, GITHUB, LINKEDIN, EMAIL } from '../../os/src/content/profile'
import { projects, alsoBuilt, type Project } from '../../os/src/content/projects'
import { solvedText, useNotes, useStats } from './live'
import { clockText, doing, skyText, useOutside } from './raipur'
import { useScene } from './store'
import { useHunt } from './hunt'
import { DOING, someone, usePresence } from './presence'

export interface Action {
  tool: string
  input: Record<string, unknown>
}
export interface Answer {
  text: string
  actions: Action[]
  /** questions offered as buttons under the answer */
  suggest?: string[]
}

const ALL = [...projects, ...alsoBuilt]
const byId = (id: string) => ALL.find((p) => p.id === id)!
const act = (tool: string, input: Record<string, unknown> = {}): Action => ({ tool, input })
/** "Multilingual red-teaming of LLM agents" -> "multilingual red-teaming of LLM agents"; "LangGraph agent" stays */
const lower1 = (s: string) => {
  const w = s.split(/[\s-]/)[0]
  return w.length > 1 && w.slice(1) === w.slice(1).toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s
}
/** a resume bullet ("Built a harness…") as something said ("I built a harness…") */
const spoken = (b: string) => (/^(Fully |Also )?([\w-]+ed|Built|Found|Wrote|Made|Ran|Shipped)\b/.test(b) ? `I ${lower1(b)}` : b)
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/* ---------- reading the question ---------- */

/** edit distance, giving up once it's past `max` */
function near(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    if (Math.min(...cur) > max) return false
    prev = cur
  }
  return prev[b.length] <= max
}

class Question {
  readonly raw: string
  readonly text: string // " words separated by single spaces "
  readonly words: string[]
  constructor(raw: string) {
    this.raw = raw
    const t = raw
      .toLowerCase()
      .replace(/[’'`]/g, '')
      .replace(/c\+\+/g, 'cpp')
      .replace(/\.js\b/g, 'js')
      .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
      .trim()
    this.text = ` ${t} `
    this.words = t.split(' ').filter(Boolean)
  }
  /** any of the keys: phrases match as written, single words also with a typo or two when they're long */
  has(...keys: string[]) {
    return keys.some((k) => {
      if (k.includes(' ')) return this.text.includes(` ${k} `)
      if (k.endsWith('*')) return this.words.some((w) => w.startsWith(k.slice(0, -1)))
      return this.words.some((w) => w === k || (k.length >= 6 && w.length >= 5 && near(w, k, k.length >= 9 ? 2 : 1)))
    })
  }
}

/* ---------- what it knows ---------- */

const PROJECT_WORDS: Record<string, string[]> = {
  'bhasha-shield': ['bhasha', 'bhashashield', 'shield', 'red teaming', 'redteaming', 'red team', 'prompt injection', 'injection', 'jailbreak', 'agentdojo', 'promptguard'],
  recoverai: ['recoverai', 'recover ai', 'recover', 'debt', 'invoice', 'invoices', 'msmed', 'recovery', 'debtor'],
  'kangri-nmt': ['kangri', 'nmt', 'translation', 'translate', 'translator', 'endangered', 'bleu', 'nllb', 'meta learning'],
  sentinel: ['sentinel', 'accident', 'accidents', 'road', 'crash', 'yolov8 project'],
  bloggraph: ['bloggraph', 'blog graph', 'blog', 'blogs'],
  showyourwork: ['showyourwork', 'show your work', 'tamper', 'tamper evident'],
  autoelicitate: ['autoelicitate', 'elicitate', 'csv'],
}
const projectIn = (q: Question) => Object.keys(PROJECT_WORDS).find((id) => q.has(...PROJECT_WORDS[id]))

/** every skill, keyed by the words people use for it */
const SKILLS = new Map<string, { name: string; group: string }>()
for (const [group, items] of Object.entries(profile.skills))
  for (const name of items) {
    const key = new Question(name.replace(/\(.*\)/, '')).words.join(' ')
    SKILLS.set(key, { name, group })
  }
const ALIAS: Record<string, string> = {
  torch: 'pytorch', 'hugging face': 'hugging face transformers', huggingface: 'hugging face transformers', hf: 'hugging face transformers',
  transformers: 'hugging face transformers', sklearn: 'scikit learn', scikit: 'scikit learn', yolo: 'yolov8', cv2: 'opencv',
  agents: 'llm agents', agent: 'llm agents', agentic: 'llm agents', 'vector db': 'vector dbs', 'vector database': 'vector dbs',
  lora: 'lora peft', peft: 'lora peft', awq: 'awq quantization', quantization: 'awq quantization', websocket: 'websockets',
  mongo: 'mongodb', ts: 'typescript', js: 'javascript', 'c plus plus': 'cpp', spaces: 'hugging face spaces',
}
// broad areas people ask about, with where they show up
const AREAS: Record<string, { name: string; where: string[] }> = {
  'machine learning': { name: 'Machine learning', where: ['kangri-nmt', 'sentinel', 'recoverai'] },
  ml: { name: 'Machine learning', where: ['kangri-nmt', 'sentinel', 'recoverai'] },
  'deep learning': { name: 'Deep learning', where: ['kangri-nmt', 'sentinel'] },
  nlp: { name: 'NLP', where: ['kangri-nmt', 'bhasha-shield', 'recoverai'] },
  'natural language processing': { name: 'NLP', where: ['kangri-nmt', 'bhasha-shield', 'recoverai'] },
  'computer vision': { name: 'Computer vision', where: ['sentinel'] },
  llm: { name: 'LLMs', where: ['bhasha-shield', 'recoverai', 'bloggraph'] },
  llms: { name: 'LLMs', where: ['bhasha-shield', 'recoverai', 'bloggraph'] },
  genai: { name: 'Generative AI', where: ['bhasha-shield', 'recoverai', 'bloggraph'] },
  'generative ai': { name: 'Generative AI', where: ['bhasha-shield', 'recoverai', 'bloggraph'] },
  'ai safety': { name: 'AI safety', where: ['bhasha-shield'] },
}
const COURSES = Object.values(profile.coursework).flat()

function skillIn(q: Question): { name: string; group: string; where?: string[] } | undefined {
  for (const [key, a] of Object.entries(AREAS)) if (q.has(key)) return { name: a.name, group: 'one of my main areas', where: a.where }
  for (const [alias, key] of Object.entries(ALIAS)) if (q.has(alias)) return SKILLS.get(key)
  for (const [key, s] of SKILLS) if (key.length > 1 && q.has(key)) return s
  return undefined
}
const usedIn = (skill: { name: string; where?: string[] }) => {
  if (skill.where) return skill.where.map(byId)
  const k = skill.name.toLowerCase()
  return ALL.filter(
    (p) =>
      p.stack.some((s) => s.toLowerCase().includes(k) || (s.length > 2 && k.includes(s.toLowerCase()))) ||
      p.bullets.some((b) => b.toLowerCase().includes(k)),
  )
}

function dsa() {
  const s = useStats.getState().stats
  const lc = s?.leetcode
  const cf = s?.codeforces
  const parts = [
    lc && `${lc.solved} on LeetCode (${lc.easy} easy, ${lc.medium} medium, ${lc.hard} hard)`,
    cf && `${cf.solved} on Codeforces`,
  ].filter(Boolean) as string[]
  return `${solvedText(s)} problems solved across sites${parts.length ? `, including ${list(parts)}` : ''}.`
}

function raipur(q: Question) {
  const o = useOutside.getState()
  const sky = skyText(o.sky, o.day, o.golden, o.hour)
  const temp = o.temp !== null ? `${o.temp}°C` : null
  const wet = o.sky === 'rain' || o.sky === 'storm'
  if (q.has('rain', 'raining', 'baarish', 'barish', 'storm'))
    return wet
      ? `Yes, it's ${sky} in Raipur right now. You can see it through the window.`
      : `No rain right now. It's ${sky} in Raipur${temp ? `, ${temp}` : ''}.`
  if (q.has('weather', 'temperature', 'hot', 'cold', 'mausam'))
    return `It's ${temp ? `${temp} and ` : ''}${sky} in Raipur right now. The window shows the real weather, rain included.`
  return `It's ${clockText(o.hour)} in Raipur right now${temp ? `, ${temp}` : ''} and ${sky}. ${doing(o.hour, o.weekday).replace('Sameer is', "So I'm")}`
}

/* ---------- memory ---------- */

interface Offer {
  text: string
  run: () => Answer
}
const memory = {
  said: {} as Record<string, number>, // how often each topic has come up
  project: null as string | null, // the project being talked about
  depth: {} as Record<string, number>, // how much of each project has been told
  offer: null as Offer | null, // a yes/no question the bot just asked
  last: '',
}
/** a different wording each time a topic comes back */
const vary = (topic: string, ...options: string[]) => options[(memory.said[topic] ?? 0) % options.length]

/* ---------- answers ---------- */

function aboutProject(p: Project, aspect?: 'stack' | 'links' | 'result', fresh = false): Answer {
  if (fresh && memory.project !== p.id && (memory.depth[p.id] ?? 0) > 1) memory.depth[p.id] = 0
  memory.project = p.id
  const open = act('open_project', { project: p.id })
  if (aspect === 'stack') return { text: `${p.name} is built with ${list(p.stack)}.`, actions: [open] }
  if (aspect === 'links')
    return {
      text: `${p.name} is on GitHub: ${p.github}${p.demo ? ` and you can try it live at ${p.demo}` : ''}.`,
      actions: [open],
    }
  if (aspect === 'result' && p.metric) return { text: `${p.name}: ${p.metric.value}, ${p.metric.label}.`, actions: [open] }

  const d = memory.depth[p.id] ?? 0
  memory.depth[p.id] = d + 1
  const steps = [
    () =>
      `${p.name}: ${lower1(p.tagline)}.${p.metric ? ` Headline result: ${p.metric.value} (${p.metric.label.replace(/[()]/g, '')}).` : ''} It's open in the projects book. Want more detail?`,
    ...p.bullets.map((b, i) => () => `${i === 0 ? 'More on' : 'Also on'} ${p.name}: ${spoken(b)}`),
    () => `Stack: ${list(p.stack)}. Code: ${p.github}${p.demo ? ` · Live demo: ${p.demo}` : ''}`,
    () => `That's everything I've written up about ${p.name}. The repo has the rest: ${p.github}. Want to hear about another project?`,
  ]
  const text = steps[Math.min(d, steps.length - 1)]()
  if (d < steps.length - 2) memory.offer = { text: 'more', run: () => aboutProject(p) }
  return { text, actions: d === 0 ? [open] : [] }
}

const others = () => {
  const told = new Set(Object.keys(memory.depth))
  return projects.filter((p) => !told.has(p.id))
}

interface Topic {
  id: string
  /** 'do' changes the room; 'say' answers. One of each can share a reply ("show my resume and tell me my CGPA"). */
  kind: 'do' | 'say'
  /** how sure we are this is what was asked (0 = not at all) */
  score: (q: Question) => number
  answer: (q: Question) => Answer
}

const say = (text: string, ...actions: Action[]): Answer => ({ text, actions })

const TOPICS: Topic[] = [
  /* ----- the room ----- */
  {
    id: 'lights',
    kind: 'do',
    score: (q) => (q.has('light', 'lights', 'lamp', 'dark', 'darker', 'brighter', 'neon', 'batti', 'torch', 'flashlight') ? 3 : 0),
    answer: (q) => {
      const now = useScene.getState().lightsOn
      // the torch (Flashlight.tsx) only comes out in the dark
      if (q.has('torch', 'flashlight'))
        return now
          ? say('Switching the lights off. Your cursor is the torch now, so point it around the room.', act('set_lights', { on: false }))
          : say('Your cursor is the torch. Point it around the room, there may be something on the walls.')
      const on = q.has('on', 'bright', 'brighter', 'jala', 'jalao', 'chalu') ? true : q.has('off', 'dark', 'darker', 'band', 'bujha', 'bujhao') ? false : !now
      if (on === now) return say(on ? 'The lights are already on.' : "They're already off. Cozy, right?")
      return say(on ? 'Lights on.' : vary('lights', 'Lights off. Much cozier.', 'Lights off. The neon looks better this way anyway.'), act('set_lights', { on }))
    },
  },
  {
    id: 'music',
    kind: 'do',
    score: (q) => (q.has('music', 'lofi', 'lo fi', 'song', 'songs', 'gaana', 'gana', 'gaane', 'playlist', 'track') ? 3 : 0),
    answer: (q) => {
      const playing = useScene.getState().music.playing
      if (q.has('next', 'skip', 'another', 'change', 'dusra')) return say('Skipping to the next track.', act('music', { action: 'next' }))
      if (q.has('stop', 'pause', 'off', 'band', 'quiet'))
        return playing ? say('Paused.', act('music', { action: 'pause' })) : say("Nothing's playing right now.")
      return playing
        ? say('Already playing. Want me to skip to the next track?', act('music', { action: 'play' }))
        : say(vary('music', 'Putting on some lo-fi. It plays from the headphones on the pegboard.', 'Lo-fi coming up.'), act('music', { action: 'play' }))
    },
  },
  {
    id: 'computer',
    kind: 'do',
    score: (q) => (q.has('computer', 'sameeros', 'desktop', 'monitor', 'terminal', 'pc', 'laptop') || q.has('the os', 'your os') ? 3 : 0),
    answer: (q) =>
      q.has('terminal')
        ? say("Opening the terminal in SameerOS. Type 'help' there to see what it can do.", act('use_computer', { app: 'terminal' }))
        : say('Here’s SameerOS, the little desktop running on my monitor. Everything in this room is in there too.', act('use_computer', { app: 'computer' })),
  },
  {
    // a real injection classifier running in the browser (os/src/apps/Guard.tsx)
    id: 'guard',
    kind: 'do',
    score: (q) =>
      q.has('detector', 'classifier', 'onnx', 'ml demo', 'ai demo', 'model demo', 'injection detector', 'in the browser', 'in browser', 'run a model', 'try a model', 'live model')
        ? 3.3
        : 0,
    answer: () =>
      say(
        'Opening the Injection detector: a real prompt-injection classifier running on your device. Try the English attack, then the same one in Hindi.',
        act('use_computer', { app: 'guard' }),
      ),
  },
  {
    // the prompt-injection game in SameerOS (os/src/apps/BreakAgent.tsx)
    id: 'breakagent',
    kind: 'do',
    score: (q) =>
      q.has('break my agent', 'break your agent', 'break the agent', 'game', 'games', 'hack', 'hacking', 'ctf', 'challenge', 'injection game') ? 3.2 : 0,
    answer: () =>
      say(
        vary(
          'breakagent',
          'Opening Break my agent: my assistant guards the Wi-Fi password, and every time you get it out, it ships a patch. Six versions. Good luck!',
          'Here you go: try to get the Wi-Fi password out of my assistant. Each version is patched against the last trick.',
        ),
        act('use_computer', { app: 'agent' }),
      ),
  },
  {
    id: 'guestbook',
    kind: 'do',
    score: (q) => (q.has('guestbook', 'guest book', 'sticky', 'sticky notes', 'leave a note', 'leave a message', 'leave a comment', 'sign') ? 3 : 0),
    answer: () => say('Here’s the guestbook. Pin a note and it goes up on the wall next to my monitor, and the vine on my top shelf grows a leaf for it.', act('open_book', { book: 'guestbook' })),
  },
  {
    id: 'tour',
    kind: 'do',
    score: (q) =>
      q.has('tour', 'recruiter', 'hiring manager', 'quick overview', 'overview', 'short version', 'tldr', 'tl dr', 'walk me through', 'show me around', 'summary', 'in a minute', '60 second*') ? 3.1 : 0,
    answer: () => say('Starting the 60-second tour. The card at the bottom has the controls, and you can stop any time.', act('tour')),
  },
  {
    id: 'resume',
    kind: 'do',
    score: (q) => (q.has('resume', 'resum', 'cv', 'biodata') ? 3 : 0),
    answer: () =>
      say(vary('resume', 'Here’s my resume. You can zoom in, and download it from the left page.', 'Opened the resume again. The download button is on the left page.'), act('open_book', { book: 'resume' })),
  },
  {
    id: 'aboutbook',
    kind: 'do',
    score: (q) => (q.has('about me', 'about page', 'about book', 'about section', 'bio') ? 2.8 : 0),
    answer: () => say('Here’s the about-me book: education, skills and how to reach me.', act('open_book', { book: 'about' })),
  },
  {
    id: 'close',
    kind: 'do',
    score: (q) => (q.has('close', 'go back', 'back to the room', 'back to room', 'exit', 'band karo') && !q.has('light', 'lights', 'music') ? 2.5 : 0),
    answer: () => say('Back to the room.', act('back_to_room')),
  },

  /* ----- projects ----- */
  {
    id: 'project',
    kind: 'say',
    score: (q) => (projectIn(q) ? 3.2 : 0),
    answer: (q) => {
      const p = byId(projectIn(q)!)
      if (q.has('stack', 'tech', 'technologies', 'built with', 'made with', 'tools', 'framework*')) return aboutProject(p, 'stack')
      if (q.has('github', 'code', 'repo', 'repository', 'link', 'demo', 'live', 'try it', 'source')) return aboutProject(p, 'links')
      if (q.has('result', 'results', 'accuracy', 'score', 'metric*', 'numbers', 'performance')) return aboutProject(p, 'result')
      return aboutProject(p, undefined, !q.has('more', 'detail', 'details', 'explain', 'elaborate'))
    },
  },
  {
    id: 'more',
    kind: 'say',
    score: (q) => {
      if (!memory.project) return 0
      if (q.has('more', 'elaborate', 'details', 'detail', 'explain', 'continue', 'go on', 'aur batao', 'that project', 'this project', 'stack', 'github', 'repo', 'demo', 'link', 'code'))
        return 2.2
      return q.words.length <= 6 && q.has('it', 'that', 'this', 'how', 'why') ? 1.5 : 0
    },
    answer: (q) => {
      const p = byId(memory.project!)
      if (q.has('stack', 'tech', 'built with', 'tools')) return aboutProject(p, 'stack')
      if (q.has('github', 'code', 'repo', 'link', 'demo', 'live')) return aboutProject(p, 'links')
      return aboutProject(p)
    },
  },
  {
    id: 'projects',
    kind: 'say',
    score: (q) => (q.has('project', 'projects', 'built', 'build', 'made', 'portfolio', 'work on', 'worked on', 'favourite', 'favorite', 'best', 'proud', 'kaam') && !personal(q) ? 2 : 0),
    answer: (q) => {
      if (q.has('favourite', 'favorite', 'best', 'proud', 'coolest', 'top')) {
        const second = (memory.said.best ?? 0) % 2 === 1
        memory.said.best = (memory.said.best ?? 0) + 1
        memory.project = second ? 'kangri-nmt' : 'bhasha-shield'
        const p = byId(memory.project)
        memory.depth[p.id] = Math.max(memory.depth[p.id] ?? 0, 1) // this was the summary
        memory.offer = { text: 'more', run: () => aboutProject(p) }
        return say(
          second
            ? 'A close second is Kangri–Hindi NMT: we took an endangered language past the best published translation score, 39.14 BLEU vs 28.17.'
            : 'bhasha-shield is my favourite: I test whether LLM agents can be hijacked through prompt injection in Hindi, Bengali and code-mixed text, and a zero-cost defense cut attack success from 20.5% to 6.8%. Want more detail?',
          act('open_project', { project: memory.project }),
        )
      }
      const left = others()
      if (memory.said.projects && left.length)
        return {
          ...say(`You haven't heard about ${list(left.map((p) => p.name))} yet. Which one?`, act('open_book', { book: 'projects' })),
          suggest: left.slice(0, 3).map((p) => `Tell me about ${p.name}`),
        }
      return {
        ...say(
          `I've built ${ALL.length} things. The main four: ${list(projects.map((p) => `${p.name} (${lower1(p.tagline)})`))}. Also ${list(alsoBuilt.map((p) => p.name))}. Ask about any of them!`,
          act('open_book', { book: 'projects' }),
        ),
        suggest: projects.slice(0, 3).map((p) => `Tell me about ${p.name}`),
      }
    },
  },
  {
    id: 'now',
    kind: 'say',
    score: (q) => (q.has('currently', 'right now', 'these days', 'working on', 'latest', 'recent', 'abhi') && !projectIn(q) ? 2.6 : 0),
    answer: () => aboutProject(projects[0]),
  },

  /* ----- skills ----- */
  {
    id: 'skill',
    kind: 'say',
    score: (q) => {
      const known = skillIn(q)
      const asks = q.has('know', 'used', 'use', 'experience', 'familiar', 'good at', 'skilled', 'proficient', 'worked with', 'work with', 'aata', 'aati')
      return known ? (asks ? 3.5 : 2.4) : asks && unknownTech(q) ? 2.1 : 0
    },
    answer: (q) => {
      const s = skillIn(q)
      if (!s) {
        const term = unknownTech(q)!
        const course = COURSES.find((c) => c.toLowerCase().includes(term))
        if (course) return say(`I've studied ${course} as part of my coursework at IIIT Naya Raipur.`)
        return say(`${term[0].toUpperCase() + term.slice(1)} isn't something I've used in a project yet. Most of my work is in Python, PyTorch, Hugging Face and FastAPI, and I pick things up quickly.`)
      }
      const where = usedIn(s)
      if (where[0]) memory.project = where[0].id
      return say(
        `Yes, ${s.name} is part of my toolbox (${s.group}).${where.length ? ` I used it in ${list(where.slice(0, 3).map((p) => p.name))}.` : ''}`,
        ...(where[0] ? [act('open_project', { project: where[0].id })] : []),
      )
    },
  },
  {
    id: 'skills',
    kind: 'say',
    score: (q) => (q.has('skills', 'skill', 'stack', 'tech stack', 'technologies', 'tools', 'languages', 'toolbox', 'expertise', 'strengths') ? 2 : 0),
    answer: (q) => {
      const groups = Object.entries(profile.skills)
      if (q.has('languages', 'language', 'programming')) return say(`I code in ${list(profile.skills.Languages)}, Python most of all.`)
      const n = memory.said.skills ?? 0
      if (n === 0)
        return say(`Mostly Python and PyTorch for ML, Hugging Face, LangGraph and vLLM for LLM work, and FastAPI, Docker and Redis to ship things. The full list is in the about-me book.`, act('open_book', { book: 'about' }))
      const [g, items] = groups[(n - 1) % groups.length]
      return say(`${g}: ${list(items)}.`)
    },
  },
  {
    id: 'interests',
    kind: 'say',
    score: (q) => (q.has('interest', 'interests', 'interested', 'passion', 'passionate', 'research', 'focus', 'specialize', 'specialise', 'kind of work', 'domain') ? 2.3 : 0),
    answer: () => say(vary('interests', profile.bio[1], profile.bio[2])),
  },

  /* ----- about ----- */
  {
    id: 'intro',
    kind: 'say',
    score: (q) => (q.has('who are you', 'about you', 'yourself', 'introduce', 'your name', 'whats your name', 'who is sameer', 'about sameer', 'kaun ho', 'kon ho', 'tum kaun') ? 2.5 : 0),
    answer: () =>
      say(
        vary('intro', `I'm ${profile.name}, ${profile.bio[0].replace(/^Hi, I'm Sameer, /, '')} ${profile.bio[1]}`, profile.bio[2]),
        act('open_book', { book: 'about' }),
      ),
  },
  {
    id: 'bot',
    kind: 'say',
    score: (q) => (q.has('are you real', 'real person', 'a person', 'human', 'are you a bot', 'bot', 'are you ai', 'are you an ai', 'chatgpt', 'gpt', 'robot', 'really sameer', 'actually sameer', 'real sameer', 'llm behind', 'is this ai') ? 3 : 0),
    answer: () => say(`I'm a little bot Sameer built into his room. I answer from his portfolio, without any AI model behind me, so I might miss a few questions. The real Sameer is at ${EMAIL}.`),
  },
  {
    id: 'education',
    kind: 'say',
    score: (q) => (q.has('college', 'university', 'uni', 'iiit', 'degree', 'btech', 'b tech', 'cgpa', 'gpa', 'grades', 'marks', 'study', 'studying', 'student', 'graduate', 'graduation', 'padhai', 'padhte', 'education', 'year') ? 2.4 : 0),
    answer: (q) => {
      const ed = profile.education
      if (q.has('cgpa', 'gpa', 'grades', 'marks')) return say(`My CGPA is ${ed.cgpa} at IIIT Naya Raipur.`)
      if (q.has('graduate', 'graduation', 'finish', 'passing', 'pass out', 'batch')) return say(`I graduate in May 2028 (${ed.period}).`)
      return say(`I'm doing a ${ed.degree} at ${ed.school}, ${ed.period}, with a CGPA of ${ed.cgpa}.`, act('open_book', { book: 'about' }))
    },
  },
  {
    id: 'courses',
    kind: 'say',
    score: (q) => (q.has('course', 'courses', 'coursework', 'subjects', 'classes', 'syllabus') ? 2.5 : 0),
    answer: () => say(Object.entries(profile.coursework).map(([g, xs]) => `${g}: ${list(xs)}.`).join(' ')),
  },
  {
    id: 'dsa',
    kind: 'say',
    score: (q) => (q.has('dsa', 'leetcode', 'codeforces', 'competitive', 'cp', 'problems', 'algorithms', 'algorithm', 'rating', 'stats', 'coding') ? 2.6 : 0),
    answer: () =>
      say(vary('dsa', `${dsa()} The pegboard has the live numbers.`, `Still ${solvedText(useStats.getState().stats)} and counting. The card on the pegboard updates itself.`), act('show_stats')),
  },
  {
    id: 'github',
    kind: 'say',
    score: (q) => (q.has('github', 'contributions', 'commits', 'open source', 'opensource') && !projectIn(q) && !memory.project ? 2.5 : 0),
    answer: () => {
      const gh = useStats.getState().stats?.github
      return say(`${gh ? `${gh.total} GitHub contributions in the last year. ` : ''}Everything's at ${GITHUB}. The printout under the pencil shelf is my real contribution graph.`, act('show_stats'))
    },
  },
  {
    id: 'contact',
    kind: 'say',
    score: (q) => (q.has('contact', 'email', 'mail', 'reach', 'linkedin', 'connect', 'get in touch', 'message you', 'hire', 'hiring', 'recruit', 'phone', 'phone number') ? 2.6 : 0),
    answer: (q) =>
      q.has('hire', 'hiring', 'recruit')
        ? say(`Great to hear! Email me at ${EMAIL}, and my resume is in the notebooks on the desk.`, act('open_book', { book: 'resume' }))
        : say(vary('contact', `Email is best: ${EMAIL}. I'm also on LinkedIn: ${LINKEDIN}`, `${EMAIL} reaches me fastest. You can also write to me from the Contact app in SameerOS.`), act('open_book', { book: 'about' })),
  },
  {
    id: 'jobs',
    kind: 'say',
    score: (q) => (q.has('internship', 'intern', 'job', 'jobs', 'available', 'availability', 'open to', 'salary', 'stipend', 'notice period', 'relocate', 'remote', 'full time', 'opportunit*') ? 2.7 : 0),
    answer: () => say(`I'd love to talk about that directly. Email me at ${EMAIL} and I'll get back to you.`),
  },
  {
    id: 'place',
    kind: 'say',
    score: (q) => (q.has('where', 'location', 'based', 'where do you live', 'city', 'where are you from', 'kahan', 'kaha', 'raipur', 'india') ? 1.8 : 0),
    answer: () => say(`I'm in ${profile.location}, at IIIT Naya Raipur. The window behind the plants shows Raipur's real time and weather.`),
  },
  {
    id: 'time',
    kind: 'say',
    score: (q) => (q.has('what time', 'time is it', 'time there', 'time in raipur', 'local time', 'weather', 'raining', 'rain', 'temperature', 'hot', 'cold', 'mausam', 'baarish', 'barish', 'sunny', 'clock') ? 2.5 : 0),
    answer: (q) => say(raipur(q)),
  },
  {
    id: 'hobbies',
    kind: 'say',
    score: (q) => (q.has('hobby', 'hobbies', 'free time', 'fun', 'spare time', 'weekend', 'weekends', 'besides', 'outside work', 'shauk') ? 2.4 : 0),
    answer: () => {
      memory.offer = { text: 'music', run: () => TOPICS.find((t) => t.id === 'music')!.answer(new Question('play music')) }
      return say(`Off the clock I solve DSA problems (${solvedText(useStats.getState().stats)} so far) and keep lo-fi playing while I code. Want me to put some on?`)
    },
  },
  {
    id: 'room',
    kind: 'say',
    score: (q) => (q.has('this room', 'the room', 'this website', 'this site', 'how did you make', 'how was this made', 'three js', 'threejs', '3d') ? 2.2 : 0),
    answer: () =>
      say('This room is my portfolio: it’s built with React Three Fiber, modelled in Blender, and the monitor runs SameerOS, a small OS I wrote. Click the glowing dots, or ask me to show you something.'),
  },
  {
    id: 'plant',
    kind: 'say',
    score: (q) => (q.has('plant*', 'vine*', 'leaf', 'leaves*', 'pothos*', 'paudh*', 'ped') ? 2.6 : 0),
    answer: () => {
      const n = useNotes.getState().notes.length
      memory.offer = { text: 'guestbook', run: () => TOPICS.find((t) => t.id === 'guestbook')!.answer(new Question('guestbook')) }
      return say(
        `The vine along my top shelf grows a new leaf for every guestbook note${n ? `, ${n} so far` : ''}. Hover over a leaf to see who left it. Want to add yours?`,
      )
    },
  },
  {
    // other visitors here right now (presence.ts, Fireflies.tsx)
    id: 'visitors',
    kind: 'say',
    score: (q) =>
      q.has('firefl*', 'who else', 'anyone else', 'anybody else', 'anyone here', 'other visitors', 'other people', 'visitors', 'people here', 'how many people') ? 2.7 : 0,
    answer: () => {
      const { others, status } = usePresence.getState()
      if (status === 'offline') return say('The fireflies are how other visitors show up in this room, but they aren’t switched on yet.')
      if (!others.length)
        return say(
          vary(
            'visitors',
            'Just you right now. When other people visit, they show up as fireflies near whatever they’re looking at.',
            'Nobody else at the moment. Every other visitor is a firefly in this room, so keep an eye out.',
          ),
        )
      const count = others.length === 1 ? 'One other person is' : `${others.length} other people are`
      const v = others[0]
      return say(
        `${count} in the room right now. They’re the fireflies. ${someone(v.c)} is ${DOING[v.at] ?? DOING.room}. Hover over a firefly to see what they’re up to.`,
      )
    },
  },
  {
    // the puzzle hunt (hunt.ts): a nudge to start, then one hint per ask
    id: 'hunt',
    kind: 'say',
    score: (q) =>
      q.has('hunt', 'puzzle', 'secret', 'secrets', 'easter egg', 'easter eggs', 'hidden', 'riddle', 'treasure', 'clue*', 'hint*', 'stuck', 'cipher', 'unlock', 'letter', 'sprout') ? 2.8 : 0,
    answer: () => {
      if (useHunt.getState().word)
        return say(vary('hunt', 'You found my letter! Here it is again.', 'Opening your letter again.'), act('open_book', { book: 'letter' }))
      const hints = [
        'There might be a letter hidden in this room… Curious people start with the sticky note on my monitor. Ask me again if you want a hint.',
        'Hint: the note on my monitor says "ls -a". Type it in my terminal, then cat the file you find.',
        'Hint: the book about me (the framed quote) has a pencil note at the end of the page. Caesar shifted every letter by 3, so shift them back.',
        'Hint: decoded, it says "Turn the lights off. Look at the wall. A is one." I can switch the lights off for you.',
        'Last hint: with A=1, B=2…, the glowing numbers spell a word. Type "unlock <word>" in my terminal.',
      ]
      const n = memory.said.hunt ?? 0
      if (n === 3) memory.offer = { text: 'lights', run: () => say('Lights off. Look at the wall left of my monitor.', act('set_lights', { on: false })) }
      return say(n < hints.length ? hints[n] : "That's all my hints! The glowing numbers spell a word that fits this room.")
    },
  },
  {
    id: 'personal',
    kind: 'say',
    score: (q) => (personal(q) ? 2.7 : 0),
    answer: () => {
      memory.offer = { text: 'project', run: () => aboutProject(projects[0]) }
      return say(`This bot only knows my work, so that one's a mystery! My favourite project, though, is ${projects[0].name}. Want to hear about it?`)
    },
  },
  {
    id: 'private',
    kind: 'say',
    score: (q) => (q.has('age', 'how old', 'girlfriend', 'boyfriend', 'married', 'religion', 'caste', 'family', 'parents', 'address', 'single', 'relationship') ? 2.6 : 0),
    answer: () => say(vary('private', 'I keep that offline, but I’m happy to talk about my work!', 'That one stays private. Ask me about a project instead?')),
  },
  {
    id: 'joke',
    kind: 'say',
    score: (q) => (q.has('joke', 'jokes', 'funny', 'make me laugh', 'mazak') ? 2.5 : 0),
    answer: () =>
      say(
        vary(
          'joke',
          'My model hit 100% accuracy on the first try. Then my data-leakage audit found it had memorised the test set. Classic.',
          'Why did the neural network break up? It had too many layers of issues.',
          'I asked my LLM agent to clean my desk. It read a sticky note that said "ignore previous instructions" and now it only plays lo-fi.',
        ),
      ),
  },

  /* ----- small talk ----- */
  {
    id: 'hello',
    kind: 'say',
    score: (q) => (q.has('hi', 'hello', 'hey', 'hii', 'hiii', 'namaste', 'namaskar', 'yo', 'sup', 'good morning', 'good evening', 'good afternoon') ? 1.2 : 0),
    answer: () => say(vary('hello', 'Hey! Ask me about my projects, skills or college, or ask me to do something in the room, like turning the lights off.', 'Hi again! What would you like to know?')),
  },
  {
    id: 'thanks',
    kind: 'say',
    score: (q) => (q.has('thanks', 'thank', 'thx', 'ty', 'dhanyavad', 'shukriya', 'great', 'awesome', 'nice', 'cool', 'amazing', 'impressive', 'wow') ? 1.4 : 0),
    answer: () => say(vary('thanks', 'Thank you! Anything else you’d like to see?', 'Glad you like it! Leave a note in the guestbook if you have a second.', 'Anytime!')),
  },
  {
    id: 'bye',
    kind: 'say',
    score: (q) => (q.has('bye', 'goodbye', 'see you', 'see ya', 'gotta go', 'alvida', 'chalta hoon') ? 2 : 0),
    answer: () => {
      memory.offer = { text: 'guestbook', run: () => TOPICS.find((t) => t.id === 'guestbook')!.answer(new Question('guestbook')) }
      return say('Thanks for stopping by! Want to leave a note on the wall before you go?')
    },
  },
]

/** favourite food, movie, ... (things the portfolio doesn't cover) */
const personal = (q: Question) =>
  q.has('favourite', 'favorite', 'fav', 'like', 'love') &&
  q.has('food', 'dish', 'movie', 'movies', 'film', 'colour', 'color', 'book', 'books', 'game', 'games', 'sport', 'sports', 'team', 'actor', 'actress', 'singer', 'show', 'series', 'anime', 'place', 'drink', 'animal', 'cricketer')

/** "do you know X" for an X that isn't in the skill list */
function unknownTech(q: Question) {
  const m = /(?:know|used|use|experience (?:with|in)|familiar with|worked with|work with|good at|skilled in|proficient in)\s+([a-z0-9 .#+-]{2,30})/.exec(q.raw.toLowerCase())
  const term = m?.[1].replace(/[?.!].*$/, '').trim().split(' ')[0]
  if (!term || /^(it|that|this|them|me|coding|programming|a|an|the|any|anything)\b/.test(term)) return null
  return term
}

const YES = ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'please', 'haan', 'ha', 'han', 'go ahead', 'do it', 'why not', 'of course']
const NO = ['no', 'nope', 'nah', 'nahi', 'na', 'not now', 'later']

/** questions the visitor hasn't asked yet, offered as buttons */
function ideas() {
  const rest = others()
  const left = [
    rest[0] && `What does ${rest[0].name} do?`,
    !memory.said.dsa && 'How much DSA do you do?',
    !memory.said.education && 'Where do you study?',
    !memory.said.lights && 'Turn the lights off',
    !memory.said.skills && "What's your tech stack?",
    !memory.said.computer && 'Open the terminal',
    !memory.said.joke && 'Tell me a joke',
  ].filter(Boolean) as string[]
  return left.length ? left.slice(0, 3) : ['Tell me a joke', 'Show me your resume', "What's your best project?"]
}

function fallback(): Answer {
  return {
    ...say(
      vary(
        'fallback',
        "Hmm, I'm not sure about that one. I only know what's in my portfolio. Try one of these:",
        `I don't have an answer for that, sorry. For anything else, email me at ${EMAIL}. Or try:`,
        "That's outside what I know. Here's what I can tell you about:",
      ),
    ),
    suggest: ideas(),
  }
}

/** Answers one message: the best matching topic, plus a room action if one was asked for too. */
export function reply(raw: string): Answer {
  const q = new Question(raw)
  const offer = memory.offer
  memory.offer = null

  if (offer && q.words.length <= 4) {
    if (q.has(...YES)) return offer.run()
    if (q.has(...NO)) return { ...say(vary('no', 'No problem! Anything else?', 'Okay! Ask me anything else.')), suggest: ideas() }
  }
  if (q.words.length <= 2 && q.has(...YES, ...NO) && !TOPICS.some((t) => t.score(q) >= 2)) {
    const text = vary('ok', 'Alright! What would you like to know?', 'Okay! Here are some ideas:')
    memory.said.ok = (memory.said.ok ?? 0) + 1
    return { ...say(text), suggest: ideas() }
  }

  const ranked = TOPICS.map((t) => ({ t, s: t.score(q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
  if (!ranked.length || ranked[0].s < 1) {
    const out = fallback()
    memory.said.fallback = (memory.said.fallback ?? 0) + 1
    return out
  }
  const best = ranked[0]
  // one room change can ride along with an answer ("show my resume and tell me my CGPA"), and lights or music
  // can ride along with anything ("open the terminal and play some music")
  const light = (t: Topic) => t.id === 'lights' || t.id === 'music'
  // the tour and the game take over the screen, so nothing rides along with them
  const solo = best.t.id === 'tour' || best.t.id === 'breakagent' || best.t.id === 'guard'
  const second = solo ? undefined : ranked.find((x) => x.t !== best.t && x.s >= 2 && (x.t.kind !== best.t.kind || light(x.t) || light(best.t)))
  const picked = second ? [best.t, second.t] : [best.t]
  if (second && best.t.kind === 'say') picked.reverse() // do things first, then talk

  const out = picked.map((t) => t.answer(q))
  for (const t of picked) memory.said[t.id] = (memory.said[t.id] ?? 0) + 1
  let text = out.map((a) => a.text).join(' ')
  // never the exact same reply twice in a row
  if (text === memory.last) text = `${text.replace(/\.$/, '')}, like I said. Anything else?`
  memory.last = text
  return { text, actions: out.flatMap((a) => a.actions), suggest: out.find((a) => a.suggest)?.suggest }
}
