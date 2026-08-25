import { useEffect, useMemo, useRef, useState } from 'react'
import type { SyncEntry, WorkspaceSyncDocument } from '../sync/workspaceSync'
import { isWorkspaceSyncDocument } from '../sync/workspaceSync'

function downloadDocument(document: WorkspaceSyncDocument): void {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = 'workspace-sync.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function TranslateTab({ document, onDocumentChange, importSignal = 0 }: { document: WorkspaceSyncDocument; onDocumentChange: (document: WorkspaceSyncDocument) => void; importSignal?: number }): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [sessionId, setSessionId] = useState('')
  const [query, setQuery] = useState('')
  const [exactMatch, setExactMatch] = useState(false)
  const [message, setMessage] = useState('Import a workspace-sync.json exported from Polyhedron Desktop.')

  useEffect(() => {
    if (importSignal > 0) inputRef.current?.click()
  }, [importSignal])

  const session = document.sessions.find((item) => item.id === sessionId) ?? document.sessions[0]
  const entries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!session) return []
    if (!normalized) return session.entries
    return session.entries.filter((entry) => {
      const fields = [entry.source, entry.target, entry.uid].map((value) => value.toLocaleLowerCase())
      return exactMatch ? fields.some((value) => value === normalized) : fields.some((value) => value.includes(normalized))
    })
  }, [exactMatch, query, session])

  const translatedCount = session?.entries.filter((entry) => entry.target.trim()).length ?? 0

  async function importDocument(file: File): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isWorkspaceSyncDocument(parsed)) throw new Error('This file is not a supported workspace sync document.')
      onDocumentChange(parsed)
      setSessionId(parsed.sessions[0]?.id ?? '')
      setMessage(`Loaded ${parsed.sessions.length} session${parsed.sessions.length === 1 ? '' : 's'} from ${file.name}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read this sync file.')
    }
  }

  function updateEntry(uid: string, target: string): void {
    onDocumentChange({
      ...document,
      generatedAt: new Date().toISOString(),
      sessions: document.sessions.map((item) => item.id !== session?.id ? item : {
        ...item,
        entries: item.entries.map((entry) => entry.uid === uid ? { ...entry, target, matchType: 'manual' as SyncEntry['matchType'] } : entry)
      })
    })
  }

  return (
    <section className="translate-panel">
      <div className="panel-toolbar">
        <div>
          <p className="eyebrow">Translate</p>
          <h2>{session ? `${session.sourceLang.toUpperCase()} → ${session.targetLang.toUpperCase()}` : 'No workspace loaded'}</h2>
          <p className="toolbar-note">{message}</p>
        </div>
        <div className="toolbar-actions">
          <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importDocument(file); event.currentTarget.value = '' }} />
          <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>Import sync file</button>
          <button type="button" className="primary-button" disabled={!session} onClick={() => downloadDocument(document)}>Export sync file</button>
        </div>
      </div>

      {document.sessions.length > 0 && (
        <div className="translate-controls">
          <select value={session?.id ?? ''} onChange={(event) => setSessionId(event.target.value)}>
            {document.sessions.map((item) => <option key={item.id} value={item.id}>{item.modName} · {item.sourceLang} → {item.targetLang}</option>)}
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search strings..." />
          <label className="exact-match"><input type="checkbox" checked={exactMatch} onChange={(event) => setExactMatch(event.target.checked)} /> Exact match</label>
          <span className="counter">{translatedCount.toLocaleString()} / {(session?.entries.length ?? 0).toLocaleString()} translated</span>
        </div>
      )}

      <div className="translate-list">
        {entries.length === 0 ? <div className="empty-state">Load a sync file from the desktop workspace to see your strings here.</div> : entries.map((entry) => <TranslationCard key={entry.uid} entry={entry} onChange={(target) => updateEntry(entry.uid, target)} />)}
      </div>
    </section>
  )
}

function TranslationCard({ entry, onChange }: { entry: SyncEntry; onChange: (value: string) => void }): React.JSX.Element {
  return <article className="translation-card"><div className="translation-meta"><span>{entry.uid}</span>{entry.needsReview && <b>Needs review</b>}</div><div className="translation-source"><LarianText value={entry.source} /></div><textarea value={entry.target} onChange={(event) => onChange(event.target.value)} placeholder="Translation..." rows={2} /><div className="translation-preview"><LarianText value={entry.target} /></div></article>
}

function LarianText({ value }: { value: string }): React.JSX.Element {
  const parts = value.split(/(<\/?LSTag\b[^>]*>)/gi)
  return <>{parts.map((part, index) => /<\/?LSTag\b[^>]*>/i.test(part) ? <span className="larian-tag" key={`${part}-${index}`}>{part}</span> : <span key={`${part}-${index}`}>{part}</span>)}</>
}

