// The chat box's conversation. Answers come from brain.ts, right here in the browser (no AI model, no server, no
// key). Each answer can come with `actions` that change the room, played one after another so the camera has time
// to glide between them.
import { create } from 'zustand'
import { useScene, singlePage } from './store'
import { sendOS } from './osLink'
import { loadPdfLib } from './pdf'
import { reply, type Action } from './brain'
import { startTour } from './tour'

export interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
  /** questions offered as buttons under the latest answer */
  suggest?: string[]
}

export const GREETING: ChatMsg = {
  role: 'assistant',
  text: "Hi! I'm a bot version of Sameer. Ask me about my work, or ask me to show you something in the room.",
  suggest: ["What's your best project?", 'Show me your resume', 'How good are you at DSA?', 'Turn the lights off'],
}
export const MAX_TEXT = 400

interface Chat {
  open: boolean
  busy: boolean
  messages: ChatMsg[]
  setOpen: (open: boolean) => void
}
export const useChat = create<Chat>((set) => ({
  open: false,
  busy: false,
  messages: [GREETING],
  setOpen: (open) => set({ open }),
}))

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function send(text: string) {
  text = text.trim().slice(0, MAX_TEXT)
  if (!text || useChat.getState().busy) return
  useChat.setState((s) => ({ messages: [...s.messages, { role: 'user', text }], busy: true }))
  const answer = reply(text)
  await wait(Math.min(1400, 450 + answer.text.length * 4)) // a beat of "typing", longer for longer answers
  useChat.setState((s) => ({ messages: [...s.messages, { role: 'assistant', text: answer.text, suggest: answer.suggest }], busy: false }))
  play(answer.actions)
}

/* ---------- actions ---------- */

const BOOK: Record<string, string> = { projects: 'books', about: 'quote', resume: 'notebooks', guestbook: 'guestbook', letter: 'letter' }

/** Does one action; returns how long to wait before the next (the camera glide). */
function run({ tool, input }: Action): number {
  const scene = useScene.getState()
  const focusOn = (key: string) => {
    if (scene.view === 'focus' && scene.focus === key) return 0
    if (key === 'notebooks') loadPdfLib()
    scene.setView('focus', key)
    return 1800
  }
  switch (tool) {
    case 'open_book':
      return BOOK[String(input.book)] ? focusOn(BOOK[String(input.book)]) : 0
    case 'open_project': {
      const glide = !(scene.view === 'focus' && scene.focus === 'books')
      scene.openProject(String(input.project))
      return glide ? 1800 : 600
    }
    case 'show_stats':
      return focusOn('stats')
    case 'use_computer':
      sendOS({ type: 'os:skipBoot' }) // straight to the desktop, the app already open
      sendOS({ type: 'os:open', app: String(input.app) })
      if (scene.view !== 'screen') scene.setView('screen')
      return 1800
    case 'set_lights':
      if (Boolean(input.on) !== scene.lightsOn) scene.toggleLights()
      return 500
    case 'music': {
      const playing = scene.music.playing
      scene.mountOS() // the music engine lives in the OS
      if (input.action === 'next') sendOS({ type: 'os:music', action: 'next' })
      else if ((input.action === 'play') !== playing) sendOS({ type: 'os:music', action: 'toggle' })
      return 300
    }
    case 'tour':
      startTour()
      return 0
    case 'back_to_room':
      if (scene.view !== 'room') scene.setView('room')
      return 1200
  }
  return 0
}

async function play(actions: Action[]) {
  if (!actions.length) return
  await wait(350) // let the reply land first
  // on phones a book or the OS fills the screen, so tuck the chat away while it's showing
  const covers = actions.some((a) => a.tool !== 'set_lights' && a.tool !== 'music')
  if (covers && singlePage()) useChat.getState().setOpen(false)
  for (const a of actions) await wait(run(a))
}
