import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      // Bundle Google Drive authentication into the main process. Leaving this
      // dependency tree external makes electron-builder omit deep pnpm
      // dependencies such as math-intrinsics from the packaged app.
      externalizeDeps: {
        exclude: ['googleapis']
      },
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          application: resolve('src/main/application.ts'),
          installer: resolve('src/main/installer.ts'),
          'merge.worker': resolve('src/main/workers/merge.worker.ts'),
          'translate.worker': resolve('src/main/workers/translate.worker.ts'),
          'xml-load.worker': resolve('src/main/workers/xml-load.worker.ts'),
          'import.worker': resolve('src/main/workers/import.worker.ts'),
          'file-task.worker': resolve('src/main/workers/file-task.worker.ts'),
          'dictionary-save.worker': resolve('src/main/workers/dictionary-save.worker.ts')
        }
      }
    }
  },
  preload: { build: { externalizeDeps: { exclude: ['@electron-toolkit/preload'] }, rollupOptions: { input: {
    index: resolve('src/preload/index.ts'), installer: resolve('src/preload/installer.ts')
  } } } },
  renderer: {
    build: { rollupOptions: { input: {
      index: resolve('src/renderer/index.html'), installer: resolve('src/renderer/installer.html')
    } } },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
