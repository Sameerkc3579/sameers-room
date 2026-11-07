// GET /api/stats: live LeetCode / Codeforces / GitHub numbers for the pegboard. Vercel's CDN caches the answer for
// 6 hours and serves the old one for up to a day while it refreshes, so the sources are hit a few times a day at most.
import { fetchStats } from '../server/stats.js'

export async function GET() {
  const stats = await fetchStats()
  const ok = stats.leetcode || stats.codeforces || stats.github
  return Response.json(stats, {
    status: ok ? 200 : 502,
    headers: { 'Cache-Control': ok ? 'public, s-maxage=21600, stale-while-revalidate=86400' : 'no-store' },
  })
}
