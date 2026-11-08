// Paper pinned up in the room, drawn live on canvases:
//   Stats      an index card (problems solved) and a printout of the GitHub contribution graph on the pegboard
//   Guestbook  the latest visitors' sticky notes on the wall beside the monitor
//   Hunt_Note  a sticky note on the monitor's corner: the puzzle hunt's first clue (hunt.ts)
// The meshes are added to the loaded room (roomModel.ts) so they get hover, clicks and hint markers like the rest.
import * as THREE from 'three'
import { NOTE_COLORS, solvedText, useNotes, useStats, type Note, type Stats } from './live'
import { cheap } from './lite'

// pegboard face is at z -0.7315 (blender/build_room.py: WALL_Z -0.75 + 0.0185); the back wall at z -0.75
const PEG_Z = -0.729
const WALL_Z = -0.7475

const INK = '#2c3527'
const SOFT = '#6a7564'
const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive'
const SANS = '"Segoe UI", system-ui, sans-serif'

function canvasTexture(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return { c, g: c.getContext('2d')!, t }
}

function paper(name: string, tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, tilt = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    cheap(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, name: 'Paper' })),
  )
  m.name = name
  m.position.set(x, y, z)
  m.rotation.z = THREE.MathUtils.degToRad(tilt)
  m.receiveShadow = true
  return m
}

const PIN_GEO = new THREE.SphereGeometry(0.0055, 16, 12)
function pin(color: string, x: number, y: number, z: number) {
  const m = new THREE.Mesh(PIN_GEO, cheap(new THREE.MeshStandardMaterial({ color, roughness: 0.35 })))
  m.position.set(x, y, z + 0.004)
  m.castShadow = true
  return m
}
function tape(x: number, y: number, z: number, tilt: number) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.045, 0.016),
    cheap(new THREE.MeshStandardMaterial({ color: '#efe6c8', transparent: true, opacity: 0.7, roughness: 0.6 })),
  )
  m.position.set(x, y, z + 0.0008)
  m.rotation.z = THREE.MathUtils.degToRad(tilt)
  return m
}

/* ---------- textures ---------- */

const card = canvasTexture(630, 840)
const graph = canvasTexture(2480, 460)
const NOTES = 4
const notes = Array.from({ length: NOTES }, () => canvasTexture(320, 320))
const huntNote = canvasTexture(320, 320)

/** Adds the pinned papers to the room once. */
export function addPinned(scene: THREE.Object3D) {
  if (scene.getObjectByName('Stats')) return

  const stats = new THREE.Group()
  stats.name = 'Stats'
  // index card left of the headphones; graph printout under the pencil shelf
  stats.add(
    paper('Stats_Card', card.t, 0.12, 0.16, 0.628, 1.622, PEG_Z, 2),
    pin('#c45a4a', 0.63, 1.692, PEG_Z),
    // (kept below the shelf lip, which hides anything higher from the room's viewpoint)
    paper('Stats_Graph', graph.t, 0.62, 0.115, 0.9, 1.183, PEG_Z, -0.4),
    tape(0.61, 1.234, PEG_Z, -18),
    tape(1.19, 1.234, PEG_Z, 16),
  )
  scene.add(stats)

  const wall = new THREE.Group()
  wall.name = 'Guestbook'
  const spots: [number, number, number][] = [
    [0.37, 1.29, -5],
    [0.46, 1.3, 4],
    [0.38, 1.2, 3],
    [0.47, 1.205, -4],
  ]
  spots.forEach(([x, y, tilt], i) => {
    const n = paper(`Guestbook_Note_${i}`, notes[i].t, 0.078, 0.078, x, y, WALL_Z + i * 0.0004, tilt)
    n.castShadow = false
    notes[i].t.userData.mesh = n // drawNotes hides notes that have nothing on them
    wall.add(n)
  })
  scene.add(wall)

  // stuck on the screen's top-right corner, half on the bezel
  scene.updateMatrixWorld(true)
  const screen = scene.getObjectByName('Screen')
  if (screen) {
    const b = new THREE.Box3().setFromObject(screen)
    drawHuntNote()
    scene.add(paper('Hunt_Note', huntNote.t, 0.046, 0.046, b.max.x - 0.006, b.max.y - 0.012, b.max.z + 0.003, 8))
  }

  // the room usually finishes loading after the data has arrived (LiveData.tsx redraws on later changes)
  drawStats(useStats.getState().stats)
  drawNotes(useNotes.getState().notes)
}

/* ---------- the index card: problems solved ---------- */

export function drawStats(s: Stats | null) {
  drawCard(s)
  drawGraph(s)
}

function drawCard(s: Stats | null) {
  const { c, g, t } = card
  const W = c.width
  const H = c.height
  g.fillStyle = '#fbf8ef'
  g.fillRect(0, 0, W, H)
  // index card rules: red header line, faint blue lines
  g.strokeStyle = 'rgba(80, 120, 190, 0.22)'
  g.lineWidth = 2
  for (let y = 210; y < H - 20; y += 62) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }
  g.strokeStyle = 'rgba(200, 80, 70, 0.45)'
  g.beginPath()
  g.moveTo(0, 150)
  g.lineTo(W, 150)
  g.stroke()

  g.textBaseline = 'alphabetic'
  g.fillStyle = SOFT
  g.font = `600 30px ${SANS}`
  g.fillText('PROBLEMS SOLVED', 44, 112)

  g.fillStyle = INK
  g.font = `700 150px ${SANS}`
  g.fillText(s ? solvedText(s) : '…', 40, 330)
  g.fillStyle = SOFT
  g.font = `italic 30px ${HAND}`
  g.fillText('across all sites', 46, 376)

  const row = (y: number, label: string, value: string, sub?: string) => {
    g.fillStyle = INK
    g.font = `600 40px ${SANS}`
    g.fillText(label, 44, y)
    g.textAlign = 'right'
    g.font = `700 44px ${SANS}`
    g.fillText(value, W - 44, y)
    g.textAlign = 'left'
    if (sub) {
      g.fillStyle = SOFT
      g.font = `28px ${SANS}`
      g.fillText(sub, 44, y + 44)
    }
  }
  const lc = s?.leetcode
  const cf = s?.codeforces
  row(450, 'LeetCode', lc ? String(lc.solved) : '–', lc ? `${lc.easy} easy · ${lc.medium} medium · ${lc.hard} hard` : undefined)
  row(580, 'Codeforces', cf ? String(cf.solved) : '–')

  // little difficulty bar for LeetCode
  if (lc && lc.solved) {
    const x0 = 44
    const w = W - 88
    let x = x0
    for (const [n, col] of [
      [lc.easy, '#8fbf7f'],
      [lc.medium, '#e0b45a'],
      [lc.hard, '#d0705f'],
    ] as const) {
      const bw = (n / lc.solved) * w
      g.fillStyle = col
      g.fillRect(x, 640, bw, 18)
      x += bw
    }
  }

  g.fillStyle = SOFT
  g.font = `italic 28px ${HAND}`
  g.fillText(s ? `live · updated ${new Date(s.updated).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'fetching…', 44, 760)
  t.needsUpdate = true
}

/* ---------- the GitHub contribution graph printout ---------- */

const LEVELS = ['#ebe8de', '#cfe0bf', '#a3c58f', '#6f9a5e', '#46703d']

function drawGraph(s: Stats | null) {
  const { c, g, t } = graph
  const W = c.width
  const H = c.height
  g.fillStyle = '#fdfcf8'
  g.fillRect(0, 0, W, H)
  const gh = s?.github
  g.textBaseline = 'alphabetic'
  g.fillStyle = INK
  g.font = `600 46px ${SANS}`
  g.fillText(gh ? `${gh.total.toLocaleString()} contributions in the last year` : 'GitHub activity', 70, 72)
  g.textAlign = 'right'
  g.fillStyle = SOFT
  g.font = `40px ${SANS}`
  g.fillText(`github.com/${gh?.user ?? 'Sameerkc3579'}`, W - 70, 72)
  g.textAlign = 'left'

  const days = gh?.days ?? []
  const x0 = 70
  const y0 = 135
  const weeks = 53
  const step = (W - x0 * 2) / weeks
  const cell = step * 0.82
  const offset = days.length ? new Date(days[0].date + 'T00:00:00Z').getUTCDay() : 0
  const at = (i: number) => ({ col: Math.floor((i + offset) / 7), row: (i + offset) % 7 })

  // month labels above the first week of each month
  g.fillStyle = SOFT
  g.font = `30px ${SANS}`
  let lastMonth = -1
  days.forEach((d, i) => {
    const month = Number(d.date.slice(5, 7))
    const { col, row } = at(i)
    if (month !== lastMonth && row === 0 && col < weeks - 1) {
      g.fillText(new Date(d.date + 'T00:00:00Z').toLocaleString('en', { month: 'short', timeZone: 'UTC' }), x0 + col * step, y0 - 14)
      lastMonth = month
    }
  })

  if (!days.length) {
    for (let col = 0; col < weeks; col++)
      for (let row = 0; row < 7; row++) {
        g.fillStyle = LEVELS[0]
        g.fillRect(x0 + col * step, y0 + row * step, cell, cell)
      }
  }
  days.forEach((d, i) => {
    const { col, row } = at(i)
    if (col >= weeks) return
    g.fillStyle = LEVELS[Math.min(4, d.level)]
    g.fillRect(x0 + col * step, y0 + row * step, cell, cell)
  })
  t.needsUpdate = true
}

/* ---------- the sticky notes on the wall ---------- */

function wrap(g: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width > width && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'
  }
  return lines
}

const WELCOME: Note = { id: 'welcome', name: 'Sameer', text: 'Say hi! Click here to leave a note on my wall.', color: 'yellow', at: '' }

export function drawNotes(list: Note[]) {
  const shown = list.length ? list.slice(0, NOTES) : [WELCOME]
  notes.forEach(({ c, g, t }, i) => {
    const n = shown[i]
    const mesh = t.userData.mesh as THREE.Mesh | undefined
    g.clearRect(0, 0, c.width, c.height)
    if (n) {
      g.fillStyle = NOTE_COLORS[n.color] ?? NOTE_COLORS.yellow
      g.fillRect(0, 0, c.width, c.height)
      // a slightly darker strip where the note is stuck down
      g.fillStyle = 'rgba(0, 0, 0, 0.05)'
      g.fillRect(0, 0, c.width, 40)
      g.fillStyle = INK
      g.font = `30px ${HAND}`
      wrap(g, n.text, c.width - 44, 5).forEach((l, k) => g.fillText(l, 22, 90 + k * 40))
      g.fillStyle = SOFT
      g.font = `26px ${HAND}`
      g.fillText(`— ${n.name}`, 22, c.height - 26)
    }
    if (mesh) mesh.visible = Boolean(n)
    t.needsUpdate = true
  })
}

/* ---------- the puzzle hunt's first clue ---------- */

function drawHuntNote() {
  const { c, g, t } = huntNote
  g.fillStyle = '#f6c9c4'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = 'rgba(0, 0, 0, 0.05)'
  g.fillRect(0, 0, c.width, 40)
  g.fillStyle = INK
  g.font = `38px ${HAND}`
  g.fillText('psst…', 26, 104)
  g.font = `600 70px ${HAND}`
  g.fillText('ls -a', 40, 196)
  g.fillStyle = SOFT
  g.font = `28px ${HAND}`
  g.fillText('(my terminal knows)', 26, 272)
  t.needsUpdate = true
}
