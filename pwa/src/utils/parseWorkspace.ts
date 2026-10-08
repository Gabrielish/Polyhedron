import { parseWorkspaceSyncDocument, type WorkspaceSyncDocument } from '../sync/workspaceSync'
export function parseWorkspaceText(text: string): Promise<WorkspaceSyncDocument> {
  if (typeof Worker === 'undefined') return Promise.resolve().then(() => parseWorkspaceSyncDocument(JSON.parse(text)))
  return parseInWorker(text)
}
export async function parseWorkspaceFile(file: File): Promise<WorkspaceSyncDocument> {
  if (!/\.pws$/i.test(file.name)) return parseWorkspaceText(await file.text())
  if (file.size > 256 * 1024 * 1024) throw new Error('This workspace is too large for browser import. Please use Google Drive sync or a smaller export.')
  if (typeof Worker === 'undefined') throw new Error('Desktop workspace import requires a browser with Web Worker support.')
  return parseInWorker(await file.arrayBuffer())
}
function parseInWorker(data: string | ArrayBuffer): Promise<WorkspaceSyncDocument> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/workspace.worker.ts', import.meta.url), { type:'module' })
    const timeout = window.setTimeout(() => { worker.terminate(); reject(new Error('Workspace import timed out. Please try again.')) }, 60000)
    const finish = () => { window.clearTimeout(timeout); worker.terminate() }
    worker.onmessage = event => { finish(); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.document) }
    worker.onerror = () => { finish(); reject(new Error('Workspace could not be imported. Please reload and try again.')) }
    worker.postMessage(data, typeof data === 'string' ? [] : [data])
  })
}
