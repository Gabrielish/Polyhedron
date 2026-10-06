import type { SourceRow } from './workspace'
export type DialogueItem = { act: string; name: string; file: string; nodes: Array<{ id: string; uid: string }> }
let worker: Worker | null = null
let request = 0
const pending = new Map<number, { resolve: (items: DialogueItem[]) => void; reject: (error: Error) => void }>()
const cache = new WeakMap<SourceRow[], Promise<DialogueItem[]>>()
export function loadDialogues(rows: SourceRow[]): Promise<DialogueItem[]> {
  const existing = cache.get(rows)
  if (existing) return existing
  if (!rows.length) return Promise.resolve([])
  const promise = new Promise<DialogueItem[]>((resolve, reject) => {
    if (!worker) {
      worker = new Worker(new URL('../workers/dialogue.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = event => { const job = pending.get(event.data.id); if (!job) return; pending.delete(event.data.id); event.data.error ? job.reject(new Error(event.data.error)) : job.resolve(event.data.items) }
      worker.onerror = () => { for (const job of pending.values()) job.reject(new Error('Dialogue worker could not be started. Please reload this page.')); pending.clear(); worker?.terminate(); worker = null }
    }
    const id = ++request
    pending.set(id, { resolve, reject })
    worker.postMessage({ id, rows, url: new URL(`${import.meta.env.BASE_URL}data/dialogue-index.json`, window.location.origin).href })
  }).catch(error => { cache.delete(rows); throw error })
  cache.set(rows, promise)
  return promise
}
