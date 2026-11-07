// Snapshot of the live stats into public/stats.json. The room shows it if /api/stats can't be reached, so the
// pegboard is never blank. A failed fetch keeps the previous snapshot.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fetchStats } from '../server/stats.js'

const out = fileURLToPath(new URL('../public/stats.json', import.meta.url))
let old = {}
try {
  old = JSON.parse(readFileSync(out, 'utf8'))
} catch {}
const s = await fetchStats()
// keep the last good value of any source that failed this time
for (const k of ['leetcode', 'codeforces', 'github']) s[k] ??= old[k] ?? null
writeFileSync(out, JSON.stringify(s))
console.log('stats ->', out, { leetcode: s.leetcode?.solved, codeforces: s.codeforces?.solved, github: s.github?.total })
