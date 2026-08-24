import { parentPort, workerData } from 'node:worker_threads'
import { type ImportWorkerInput, runImportWorker } from './import.worker.runtime'

if (parentPort === null) {
  throw new Error('import.worker must be spawned via worker_threads')
}

const port = parentPort

;(async () => {
  try {
    await runImportWorker(workerData as ImportWorkerInput, (msg) => port.postMessage(msg))
    process.exit(0)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    port.postMessage({ phase: 'error', message })
    process.exit(1)
  }
})()
