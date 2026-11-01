import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Runs the Vercel functions in api/ (stats, guestbook, hunt) inside the dev server, so `npm run dev` behaves like the
 * deployed site. Each file exports GET / POST / DELETE handlers that take a Request and return a Response.
 * Server secrets (KV_REST_API_*, GUESTBOOK_ADMIN_KEY) can go in scene/.env.local; only the functions see them.
 */
function apiRoutes(): Plugin {
  return {
    name: 'api-routes',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, ''))
      process.env.GUESTBOOK_DEV = '1' // the guestbook and the hunt's hall keep entries in memory unless Upstash is configured
      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\/+|\/+$/g, '')
        if (!/^[a-z]+$/.test(name)) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          const handler = mod[req.method ?? 'GET']
          if (!handler) {
            res.statusCode = 405
            return res.end()
          }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const request = new Request(`http://localhost${req.originalUrl}`, {
            method: req.method,
            headers,
            body: chunks.length && req.method !== 'GET' ? Buffer.concat(chunks) : undefined,
          })
          const response: Response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), apiRoutes()],
  // the room's info panels reuse SameerOS's content (os/src/content), one folder up
  server: { fs: { allow: ['..'] } },
})
