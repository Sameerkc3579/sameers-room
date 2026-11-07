// Live coding stats for the pegboard (StatsBoard.tsx): problems solved on LeetCode and Codeforces, and the
// GitHub contribution calendar. Used by api/stats.js (cached at the edge) and scripts/stats.mjs (build snapshot).

export const HANDLES = {
  github: 'Sameerkc3579',
  leetcode: 'im__sameer',
  codeforces: 'sameer24102',
}

const UA = { 'User-Agent': 'sameers-room (portfolio stats)' }

async function leetcode(user) {
  const r = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { ...UA, 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
    body: JSON.stringify({
      query: `query($u: String!) { matchedUser(username: $u) { submitStatsGlobal { acSubmissionNum { difficulty count } } } }`,
      variables: { u: user },
    }),
  })
  const d = await r.json()
  const rows = d?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum
  if (!rows) throw new Error('leetcode: no data')
  const by = Object.fromEntries(rows.map((x) => [x.difficulty.toLowerCase(), x.count]))
  return { user, solved: by.all ?? 0, easy: by.easy ?? 0, medium: by.medium ?? 0, hard: by.hard ?? 0 }
}

async function codeforces(user) {
  const r = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(user)}`, { headers: UA })
  const d = await r.json()
  if (d.status !== 'OK') throw new Error('codeforces: ' + d.comment)
  // a problem counts once, however many accepted submissions it has
  const solved = new Set()
  for (const s of d.result) if (s.verdict === 'OK') solved.add(`${s.problem.contestId ?? ''}/${s.problem.index}/${s.problem.name}`)
  return { user, solved: solved.size }
}

/** The public contribution calendar on github.com (no token needed): one entry per day for the last year. */
async function github(user) {
  const r = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`, { headers: UA })
  if (!r.ok) throw new Error('github: ' + r.status)
  const html = await r.text()
  const counts = new Map() // cell id -> contributions that day
  for (const m of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = /^(\d[\d,]*) contribution/.exec(m[2].trim())
    counts.set(m[1], n ? Number(n[1].replace(/,/g, '')) : 0)
  }
  const days = []
  for (const m of html.matchAll(/<td\b[^>]*\bdata-date="([\d-]+)"[^>]*>/g)) {
    const id = /\bid="([^"]+)"/.exec(m[0])?.[1]
    const level = Number(/\bdata-level="(\d)"/.exec(m[0])?.[1] ?? 0)
    days.push({ date: m[1], level, count: counts.get(id) ?? 0 })
  }
  if (!days.length) throw new Error('github: calendar not found')
  days.sort((a, b) => (a.date < b.date ? -1 : 1))
  const total = Number(/([\d,]+)\s+contributions?\s+in the last year/.exec(html)?.[1].replace(/,/g, '') ?? NaN)
  return { user, total: Number.isFinite(total) ? total : days.reduce((s, d) => s + d.count, 0), days }
}

/** Everything at once; a source that fails comes back as null so the rest still shows. */
export async function fetchStats() {
  const settle = (p) => p.catch((e) => (console.warn(String(e)), null))
  const [lc, cf, gh] = await Promise.all([
    settle(leetcode(HANDLES.leetcode)),
    settle(codeforces(HANDLES.codeforces)),
    settle(github(HANDLES.github)),
  ])
  return { updated: new Date().toISOString(), leetcode: lc, codeforces: cf, github: gh }
}
