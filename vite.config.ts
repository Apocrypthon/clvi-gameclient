import { defineConfig } from 'vite'

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

export default defineConfig({
  base: './',
  // Classic (iife) workers: broadest iOS Safari support. See docs/ARCHITECTURE.md.
  worker: { format: 'iife' },
  build: { target: 'es2020' },
  define: { __BUILD_STAMP__: JSON.stringify(stamp) },
})
