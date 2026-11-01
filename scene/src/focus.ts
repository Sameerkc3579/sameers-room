/** How the camera frames each focused object: distance from it and which side it sits off-centre to (+1 right,
 * -1 left, 0 centred). `target` aims at a point other than the object's hint marker. Objects that open a book
 * (Book.tsx) don't need exact framing; the stats close-up does. */
export const FOCUS: Record<string, { dist: number; side: 1 | 0 | -1; target?: [number, number, number] }> = {
  books: { dist: 1.4, side: 1 },
  quote: { dist: 1.55, side: 1 },
  notebooks: { dist: 1.35, side: -1 },
  guestbook: { dist: 1.2, side: 1 },
  // the index card and the GitHub printout on the pegboard (pinned.ts), close enough to read
  stats: { dist: 1.0, side: 0, target: [0.9, 1.37, -0.73] },
  // the puzzle hunt's sticky note on the monitor, close enough to read
  huntnote: { dist: 0.38, side: 0 },
}
