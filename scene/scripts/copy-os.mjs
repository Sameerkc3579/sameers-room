// Copies the built SameerOS (../os/dist) into public/os so the monitor's iframe can load it.
import { cpSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../../os/dist', import.meta.url))
const dest = fileURLToPath(new URL('../public/os', import.meta.url))
if (!existsSync(src)) throw new Error('Build the OS first: npm --prefix ../os run build')
rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true })
console.log('copied OS ->', dest)
