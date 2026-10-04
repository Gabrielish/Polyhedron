import path from 'node:path'
import { Worker } from 'node:worker_threads'
import type { UpsertParams } from '../database/repositories/dictionary.repo'
import { databasePath } from '../utils/app-paths'

let pending: Promise<void> = Promise.resolve()
let sharedWorker: Worker | null = null
function getWorker(): Worker {
  if (sharedWorker) return sharedWorker
  const worker = new Worker(path.join(__dirname, 'dictionary-save.worker.js'))
  worker.unref()
  sharedWorker = worker
  const reset = () => {
    if (sharedWorker === worker) sharedWorker = null
  }
  worker.on('error', reset)
  worker.on('exit', reset)
  return worker
}
export function saveDictionaryEntries(entries: UpsertParams[]): Promise<void> {
  const save = pending
    .catch(() => undefined)
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          const worker = getWorker()
          const cleanup = () => {
            worker.off('message', onMessage)
            worker.off('error', onError)
            worker.off('exit', onExit)
          }
          const onMessage = (result: { success?: boolean; error?: string }) => {
            cleanup()
            if (result.error) reject(new Error(result.error))
            else resolve()
          }
          const onError = (error: Error) => {
            cleanup()
            reject(error)
          }
          const onExit = (code: number) => {
            cleanup()
            reject(new Error(`Dictionary save exited without a result (${code})`))
          }
          worker.once('message', onMessage)
          worker.once('error', onError)
          worker.once('exit', onExit)
          try {
            worker.postMessage({ dbPath: databasePath(), entries })
          } catch (error) {
            onError(error instanceof Error ? error : new Error(String(error)))
          }
        })
    )
  pending = save
  return save
}
export async function flushDictionarySaves(): Promise<void> {
  for (;;) {
    const current = pending
    await current.catch(() => undefined)
    if (pending === current) return
  }
}
