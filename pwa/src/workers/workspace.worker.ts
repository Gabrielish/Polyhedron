import { parseWorkspaceSyncDocument } from '../sync/workspaceSync'
const scope = self as unknown as { onmessage: ((event: MessageEvent<string | ArrayBuffer>) => void) | null; postMessage: (value: unknown) => void }
scope.onmessage = async event => {
  try {
    if (typeof event.data === 'string') scope.postMessage({ document: parseWorkspaceSyncDocument(JSON.parse(event.data)) })
    else {
      const [{ parsePwsWorkspace }, { default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
        import('../utils/pwsWorkspace'), import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url')
      ])
      const SQL = await initSqlJs({ locateFile: () => wasmUrl })
      scope.postMessage({ document: await parsePwsWorkspace(new Uint8Array(event.data), SQL) })
    }
  }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Invalid workspace file.' }) }
}
