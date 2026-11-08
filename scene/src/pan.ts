// Portrait screens swipe sideways to look around the room (CameraRig.tsx): -1 is the window, +1 the pegboard.
// `v` follows `to` (straight under the finger while `dragging`, smoothly otherwise); `touched` is set once the
// visitor has swiped themselves.
import { create } from 'zustand'

export const pan = { v: 0, to: 0, touched: false, dragging: false }

/** the "swipe to look around" nudge (Overlay.tsx), shown while the camera's first glance to the right plays */
export const useSwipeHint = create<{ show: boolean }>(() => ({ show: false }))
