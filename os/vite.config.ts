import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the built OS works both standalone and from /os/ inside the 3D scene
export default defineConfig({
  base: './',
  plugins: [react()],
  // XP.css ships one selector lightningcss's minifier rejects; it's already minified anyway
  build: { cssMinify: false },
})
