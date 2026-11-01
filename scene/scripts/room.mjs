// Rebuilds public/models/room.glb: runs blender/build_room.py in headless Blender (raw, ~50 MB), then compresses it
// for the web with gltf-transform (WebP textures, meshopt geometry). Set BLENDER to override the executable path.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const candidates = [
  process.env.BLENDER,
  'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',
  '/Applications/Blender.app/Contents/MacOS/Blender',
  'blender',
].filter(Boolean)
const blender = candidates.find((c) => c === 'blender' || existsSync(c))

const out = execFileSync(
  blender,
  ['-b', '-P', '../blender/build_room.py', '--', '--out', '../blender/room_raw.glb', '--blend', '../blender/room.blend'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
)
const done = out.split('\n').find((l) => l.startsWith('EXPORTED'))
if (!done) {
  console.error(out.slice(-3000))
  process.exit(1)
}
console.log(done)

// Names matter (Screen, Lamp_Light, the clickable objects), so no joining/flattening/pruning here.
execFileSync(
  process.execPath,
  ['node_modules/@gltf-transform/cli/bin/cli.js', 'optimize', '../blender/room_raw.glb', 'public/models/room.glb',
    '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024',
    '--flatten', 'false', '--join', 'false', '--instance', 'false', '--simplify', 'false',
    '--palette', 'false', '--prune', 'false'],
  { stdio: ['ignore', 'ignore', 'inherit'] },
)
console.log('compressed -> public/models/room.glb')
