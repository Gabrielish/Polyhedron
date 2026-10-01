import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/Polyhedron/',
  plugins: [react()],
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true }
})
