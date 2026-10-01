import { parentPort, workerData } from 'node:worker_threads'
import { runTranslateWorker, type TranslateWorkerInput } from './translate.worker.runtime'

if (parentPort === null) {
  throw new Error('translate.worker must be spawned via worker_threads')
}

const port = parentPort
let cancelHandler: (() => void) | undefined

port.on('message', (msg: unknown) => {
  if (
    msg !== null &&
    typeof msg === 'object' &&
    (msg as Record<string, unknown>).type === 'cancel'
  ) {
    cancelHandler?.()
  }
})

;(async () => {
  try {
    await runTranslateWorker(
      workerData as TranslateWorkerInput,
      (msg) => port.postMessage(msg),
      (handler) => {
        cancelHandler = handler
      }
    )
    process.exit(0)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    port.postMessage({ phase: 'error', message })
    process.exit(1)
  }
})()
