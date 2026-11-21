export {}

interface IndexedRow {
  rowId: string
  uid: string
  source: string
  target: string
  folded: string
}

type WorkerMessage =
  | { type: 'index'; rows: Array<{ rowId: string; uid: string; source: string; target: string }> }
  | { type: 'search'; query: string; matchCase: boolean; wholeWord: boolean; exactMatch: boolean; startsWith: boolean; endsWith: boolean }

let rows: IndexedRow[] = []
let ready = false
let pendingSearch: Extract<WorkerMessage, { type: 'search' }> | null = null
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function search(request: Extract<WorkerMessage, { type: 'search' }>): void {
  const rawQuery = request.query.trim()
  const query = request.matchCase ? fold(rawQuery) : fold(rawQuery).toLocaleLowerCase()
  const escaped = request.wholeWord ? query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
  const wholeWordPattern = request.wholeWord
    ? new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, 'u')
    : null
  const hits: string[] = []
  if (query) {
    for (const row of rows) {
      const candidate = request.matchCase ? fold(`${row.source}\n${row.target}\n${row.uid}`) : row.folded
      const matches = request.exactMatch
          ? candidate.split('\n').some((part) => part === query)
          : request.startsWith
            ? candidate.split('\n').some((part) => part.startsWith(query))
            : request.endsWith
              ? candidate.split('\n').some((part) => part.endsWith(query))
        : wholeWordPattern
          ? wholeWordPattern.test(candidate)
          : candidate.includes(query)
      if (matches) hits.push(row.rowId)
    }
  }
  postMessage({ type: 'results', rowIds: hits })
}

onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data
  if (message.type === 'index') {
    rows = message.rows.map((row) => ({
      ...row,
      folded: fold(`${row.source}\n${row.target}\n${row.uid}`).toLocaleLowerCase()
    }))
    ready = true
    postMessage({ type: 'ready' })
    if (pendingSearch) search(pendingSearch)
  } else if (ready) {
    search(message)
  } else {
    pendingSearch = message
  }
}
