import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { app } from 'electron'
import type { ImportProgress, ImportWorkerInput } from '../workers/import.worker.runtime'

export type { ImportProgress }

export type ImportProgressUpdate = Exclude<ImportProgress, { phase: 'done' } | { phase: 'error' }>

export interface RunImportParams {
  filePath: string
  onProgress?: (p: ImportProgressUpdate) => void
}

export function runImport(params: RunImportParams): Promise<number> {
  const { onProgress, filePath } = params
  const input: ImportWorkerInput = { filePath, dbPath: getDbPath() }

  return new Promise<number>((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'import.worker.js'), { workerData: input })

    worker.on('message', (msg: ImportProgress) => {
      if (msg.phase === 'done') {
        resolve(msg.count)
        return
      }
      if (msg.phase === 'error') {
        reject(new Error(msg.message))
        return
      }
      onProgress?.(msg)
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`import worker exited with code ${code}`))
    })
  })
}

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'icosa.db')
}
