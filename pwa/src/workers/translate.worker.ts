import { filterTranslations, type TranslateOptions } from '../utils/translateSearch'
import type { SyncEntry } from '../sync/workspaceSync'
let rows: SyncEntry[] = []
type Request = { id: number; rows?: SyncEntry[]; patches?: Array<[number, SyncEntry]>; options: TranslateOptions }
const scope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage: (value: unknown) => void }
scope.onmessage = ({ data }) => {
  try {
    if (data.rows) rows = data.rows
    if (data.patches) for (const [index, row] of data.patches) rows[index] = row
    scope.postMessage({ id: data.id, result: filterTranslations(rows, data.options) })
  } catch { scope.postMessage({ id: data.id, error: 'Search could not be completed.' }) }
}
