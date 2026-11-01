// What can be clicked in the room. Keys are object names from blender/build_room.py.
import type { Object3D } from 'three'
import { useScene } from './store'
import { sendOS, type ToOS } from './osLink'
import { loadPdfLib } from './pdf'

export interface Interactable {
  label: string
  action: () => void
}

const toScreen = (...msgs: ToOS[]) => () => {
  msgs.forEach(sendOS)
  useScene.getState().setView('screen')
}
/** glide over to the object, then its content opens as a book (Books.tsx) */
const focus = (key: string) => () => useScene.getState().setView('focus', key)

export const INTERACTABLES: Record<string, Interactable> = {
  monitor: { label: 'Use the computer', action: toScreen() },
  books: { label: 'Projects', action: focus('books') },
  headphones: {
    label: 'Play lo-fi',
    action: () => {
      useScene.getState().mountOS() // the music engine lives in the OS; no need to zoom in
      sendOS({ type: 'os:music', action: 'toggle' })
    },
  },
  quote: { label: 'About me', action: focus('quote') },
  notebooks: {
    label: 'Resume',
    action: () => {
      loadPdfLib() // fetch the PDF renderer during the camera glide
      focus('notebooks')()
    },
  },
  lamp: { label: 'Lights on / off', action: () => useScene.getState().toggleLights() },
  stats: { label: 'My stats', action: focus('stats') },
  guestbook: { label: 'Guestbook', action: focus('guestbook') },
  // the puzzle hunt's first clue (hunt.ts): no hint dot, it's for the curious
  huntnote: { label: 'A note', action: focus('huntnote') },
}

/** Blender object name -> interactable key */
const BY_NAME: Record<string, string> = {
  Screen: 'monitor',
  Monitor: 'monitor',
  Keyboard: 'monitor',
  Books: 'books',
  Headphones: 'headphones',
  Quote_Frame: 'quote',
  Notebooks: 'notebooks',
  Mushroom_Lamp: 'lamp',
  Stats: 'stats', // pinned.ts
  Guestbook: 'guestbook',
  Hunt_Note: 'huntnote', // pinned.ts
}

/** The object each hint marker sits on (see Hints.tsx): just above it, or on its front face for objects that
 * sit at the top edge of the view (the quote print on the upper shelf). */
export const ANCHORS: Record<string, { name: string; at: 'top' | 'front'; hidden?: boolean }> = {
  monitor: { name: 'Monitor', at: 'top' },
  books: { name: 'Books', at: 'top' },
  headphones: { name: 'Headphones', at: 'top' },
  quote: { name: 'Quote_Frame', at: 'front' },
  notebooks: { name: 'Notebooks', at: 'top' },
  lamp: { name: 'Mushroom_Lamp', at: 'top' },
  stats: { name: 'Stats_Card', at: 'front' },
  guestbook: { name: 'Guestbook', at: 'front' },
  huntnote: { name: 'Hunt_Note', at: 'front', hidden: true }, // the camera can go there, but no dot shows it
}

/** Walks up from a hit mesh (multi-material objects load as a group of meshes) to its interactable key. */
export function keyOf(o: Object3D | null): string | null {
  for (let n = o; n; n = n.parent) if (BY_NAME[n.name]) return BY_NAME[n.name]
  return null
}
