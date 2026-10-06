import { parseWorkspaceSyncDocument } from '../sync/workspaceSync'
const scope = self as unknown as { onmessage: ((event: MessageEvent<string>) => void) | null; postMessage: (value: unknown) => void }
scope.onmessage = event => {
  try { scope.postMessage({ document: parseWorkspaceSyncDocument(JSON.parse(event.data)) }) }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Invalid workspace file.' }) }
}
