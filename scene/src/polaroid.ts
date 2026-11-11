// Polaroid photo mode: the camera in the dock (or "take a photo" in the chat) snaps the room exactly as it's showing
// (time, weather, lights and all) and prints it as a polaroid: a white frame, a handwritten caption with the date
// and Raipur's weather, and an old film camera's orange date stamp in the corner. Photo.tsx takes the picture and
// shows it developing; this file holds the state and draws the print.
import { create } from 'zustand'
import { useScene } from './store'
import { useOutside, picked, clockText, skyText } from './raipur'
import { shutter } from './sound'
import { t } from './i18n'

export const SITE = 'sameers-room.vercel.app'

interface Photo {
  /** the flash is up and the picture is being taken */
  taking: boolean
  /** the finished print, and where its photo sits on it (fractions of the print), for the developing overlay */
  print: { url: string; blob: Blob; name: string; hole: { x: number; y: number; w: number; h: number } } | null
  /** bumps for each flash (the replay flashes too) */
  flashes: number
}
export const usePhoto = create<Photo>(() => ({ taking: false, print: null, flashes: 0 }))

export function takePhoto() {
  if (usePhoto.getState().taking) return
  closePhoto()
  useScene.getState().setHover(null) // no highlighted object in the picture
  flash()
  usePhoto.setState({ taking: true })
}

export function closePhoto() {
  const p = usePhoto.getState().print
  if (p) URL.revokeObjectURL(p.url)
  usePhoto.setState({ print: null })
}

/** the white flash and the shutter's sound */
export function flash() {
  shutter()
  usePhoto.setState((s) => ({ flashes: s.flashes + 1 }))
}

/* ---------- the print ---------- */

const rand = (i: number) => {
  const x = Math.sin(i * 91.7 + 13.1) * 43758.5453
  return x - Math.floor(x)
}

/** Lays the photo out as a polaroid and hands back the print. */
export async function printPolaroid(photo: HTMLCanvasElement) {
  const W = photo.width
  const H = photo.height
  const u = Math.sqrt(W * H) // one unit, so every size of photo gets the same look
  const side = Math.round(u * 0.055)
  const bottom = Math.round(u * 0.21)
  const c = Object.assign(document.createElement('canvas'), { width: W + side * 2, height: H + side + bottom })
  const g = c.getContext('2d')!

  // the paper: warm white, a soft sheen and a little grain
  g.fillStyle = '#f6f3eb'
  g.fillRect(0, 0, c.width, c.height)
  const sheen = g.createLinearGradient(0, 0, c.width, c.height)
  sheen.addColorStop(0, 'rgba(255,255,255,0.55)')
  sheen.addColorStop(1, 'rgba(225,218,202,0.35)')
  g.fillStyle = sheen
  g.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(120,105,80,${0.025 + rand(i) * 0.04})`
    g.fillRect(rand(i + 7) * c.width, rand(i + 13) * c.height, 1.5, 1.5)
  }

  // the photo, with an instant film's warmth, faded blacks and darker corners
  g.drawImage(photo, side, side)
  g.save()
  g.beginPath()
  g.rect(side, side, W, H)
  g.clip()
  g.globalCompositeOperation = 'screen'
  g.fillStyle = 'rgba(52,38,26,0.16)'
  g.fillRect(side, side, W, H)
  g.globalCompositeOperation = 'soft-light'
  g.fillStyle = 'rgba(255,214,160,0.22)'
  g.fillRect(side, side, W, H)
  g.globalCompositeOperation = 'multiply'
  const corners = g.createRadialGradient(side + W / 2, side + H / 2, Math.min(W, H) * 0.35, side + W / 2, side + H / 2, Math.hypot(W, H) * 0.62)
  corners.addColorStop(0, 'rgba(255,255,255,1)')
  corners.addColorStop(1, 'rgba(150,135,120,1)')
  g.fillStyle = corners
  g.fillRect(side, side, W, H)
  g.restore()
  // where the photo meets the paper
  g.strokeStyle = 'rgba(40,32,24,0.35)'
  g.lineWidth = Math.max(1, u * 0.0012)
  g.strokeRect(side, side, W, H)

  // an old film camera's date stamp: '26 11 11, glowing orange in the corner
  const o = useOutside.getState()
  const now = new Date(Date.now() + 5.5 * 3600_000) // Raipur's date (read with getUTC*)
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `'${pad(now.getUTCFullYear() % 100)} ${pad(now.getUTCMonth() + 1)} ${pad(now.getUTCDate())}`
  g.save()
  g.font = `bold ${Math.round(u * 0.036)}px ui-monospace, Consolas, 'Courier New', monospace`
  g.textAlign = 'right'
  g.textBaseline = 'alphabetic'
  g.shadowColor = 'rgba(255,120,40,0.9)'
  g.shadowBlur = u * 0.012
  g.fillStyle = '#ff9a4a'
  g.fillText(stamp, side + W - u * 0.035, side + H - u * 0.03)
  g.restore()

  // the caption, as if written on with a pen
  const ink = '#2b3550'
  const hand = `'Segoe Print', 'Bradley Hand', 'Noteworthy', 'Comic Neue', 'Nirmala UI', Georgia, serif`
  await document.fonts?.load(`${Math.round(u * 0.05)}px 'Segoe Print'`).catch(() => {})
  const line1 = t("Sameer's room, Raipur", 'Sameer का कमरा, रायपुर')
  const sky = skyText(o.sky, o.day, o.golden, o.hour)
  const months = t('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec', 'जनवरी फ़रवरी मार्च अप्रैल मई जून जुलाई अगस्त सितंबर अक्टूबर नवंबर दिसंबर').split(' ')
  const date = `${now.getUTCDate()} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()}`
  const temp = !picked(o) && o.temp !== null ? `, ${o.temp}°C` : ''
  const line2 = `${date} · ${clockText(o.hour)} · ${sky}${temp}`
  const y0 = side + H
  g.fillStyle = ink
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.font = `${Math.round(u * 0.05)}px ${hand}`
  g.save()
  g.translate(side + u * 0.01, y0 + bottom * 0.4)
  g.rotate(-0.012)
  g.fillText(line1, 0, 0)
  g.restore()
  g.globalAlpha = 0.8
  g.font = `${Math.round(u * 0.027)}px ${hand}`
  g.fillText(line2, side + u * 0.012, y0 + bottom * 0.72)
  g.globalAlpha = 0.45
  g.textAlign = 'right'
  g.font = `${Math.round(u * 0.02)}px 'Segoe UI', system-ui, sans-serif`
  g.fillStyle = '#4a4438'
  g.fillText(SITE, c.width - side, y0 + bottom * 0.74)
  g.globalAlpha = 1

  const blob = await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('no image'))), 'image/jpeg', 0.92))
  return {
    url: URL.createObjectURL(blob),
    blob,
    name: `sameers-room-${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}.jpg`,
    hole: { x: side / c.width, y: side / c.height, w: W / c.width, h: H / c.height },
  }
}
