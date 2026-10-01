import { parentPort, workerData } from 'node:worker_threads'
import { runXmlLoadWorker, type XmlLoadWorkerInput } from './xml-load.worker.runtime'

if (parentPort === null) {
  throw new Error('xml-load.worker must be spawned via worker_threads')
}

const port = parentPort

;(async () => {
  try {
    await runXmlLoadWorker(workerData as XmlLoadWorkerInput, (msg) => port.postMessage(msg))
    process.exit(0)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    port.postMessage({ phase: 'error', message })
    process.exit(1)
  }
})()
