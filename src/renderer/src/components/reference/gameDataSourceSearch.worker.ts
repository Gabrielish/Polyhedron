interface SearchRow {
  rowId: string
  uid: string
  source: string
  sourceFolded: string
  uidFolded: string
}

type WorkerMessage =
  | { type: 'index'; rows: Array<{ rowId: string; uid: string; source: string }> }
  | { type: 'search'; query: string; matchCase: boolean; wholeWord: boolean; exactMatch: boolean; startsWith: boolean; endsWith: boolean; selectedUid: string }

let rows: SearchRow[] = []
let ready = false
let pendingSearch: Extract<WorkerMessage, { type: 'search' }> | null = null
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function search(request: Extract<WorkerMessage, { type: 'search' }>): void {
  const query = request.matchCase ? fold(request.query.trim()) : fold(request.query.trim()).toLocaleLowerCase()
  const hits: string[] = []
  if (query) {
    const escaped = request.wholeWord ? query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
    const wholeWordPattern = request.wholeWord
      ? new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, 'u')
      : null
    for (const row of rows) {
      const source = request.matchCase ? row.source : row.sourceFolded
      const uid = request.matchCase ? row.uid : row.uidFolded
      const matches = request.exactMatch
        ? source === query || uid === query
        : request.startsWith
          ? source.startsWith(query) || uid.startsWith(query)
          : request.endsWith
            ? source.endsWith(query) || uid.endsWith(query)
        : wholeWordPattern
          ? wholeWordPattern.test(source) || wholeWordPattern.test(uid)
          : source.includes(query) || uid.includes(query)
      if (matches) {
        hits.push(row.rowId)
      }
    }
  }
  postMessage({ type: 'results', rowIds: hits })
}

onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data
  if (message.type === 'index') {
    rows = message.rows.map((row) => ({
      ...row,
      sourceFolded: fold(row.source).toLocaleLowerCase(),
      uidFolded: fold(row.uid).toLocaleLowerCase()
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
