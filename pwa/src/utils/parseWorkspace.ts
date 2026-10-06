import { parseWorkspaceSyncDocument, type WorkspaceSyncDocument } from '../sync/workspaceSync'
export function parseWorkspaceText(text: string): Promise<WorkspaceSyncDocument> {
  if (typeof Worker === 'undefined') return Promise.resolve().then(() => parseWorkspaceSyncDocument(JSON.parse(text)))
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/workspace.worker.ts', import.meta.url), { type:'module' })
    const timeout = window.setTimeout(() => { worker.terminate(); reject(new Error('Workspace import timed out. Please try again.')) }, 60000)
    const finish = () => { window.clearTimeout(timeout); worker.terminate() }
    worker.onmessage = event => { finish(); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.document) }
    worker.onerror = () => { finish(); reject(new Error('Workspace could not be imported. Please reload and try again.')) }
    worker.postMessage(text)
  })
}
