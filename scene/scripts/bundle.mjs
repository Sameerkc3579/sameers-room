// Puts together scene/deploy/: the built site plus the Vercel functions (api/ + server/), ready for
//   npm run build && npm run bundle && cd deploy && vercel deploy --prod
// The first time, `vercel link` it to the existing project (sameers-room) so the domain and env vars carry over.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const out = at('deploy')
if (!existsSync(at('dist/index.html'))) throw new Error('Build first: npm run build')

// keep the Vercel project link between bundles, replace everything else
mkdirSync(out, { recursive: true })
for (const f of readdirSync(out)) if (f !== '.vercel') rmSync(`${out}/${f}`, { recursive: true, force: true })

cpSync(at('dist'), out, { recursive: true })
cpSync(at('api'), `${out}/api`, { recursive: true })
cpSync(at('server'), `${out}/server`, { recursive: true })
// the functions are ES modules
writeFileSync(`${out}/package.json`, JSON.stringify({ private: true, type: 'module' }, null, 2) + '\n')
writeFileSync(
  `${out}/vercel.json`,
  JSON.stringify(
    {
      headers: [
        { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        { source: '/(models|textures)/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
      ],
    },
    null,
    2,
  ) + '\n',
)
writeFileSync(`${out}/.vercelignore`, '.env*\n')
console.log('deploy folder ready ->', out)
