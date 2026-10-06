import { useEffect, useRef, useState } from 'react'
import type { SyncEntry } from '../sync/workspaceSync'
import { filterTranslations, type SearchResult, type TranslateOptions } from './translateSearch'
const empty: SearchResult = { indices: [], total: 0, translated: 0, counts: {} }
export function useTranslateSearch(entries: SyncEntry[], options: TranslateOptions): { result: SearchResult; searching: boolean } {
  const [result, setResult] = useState(empty)
  const [searching, setSearching] = useState(false)
  const worker = useRef<Worker | null>(null)
  const previous = useRef<SyncEntry[] | null>(null)
  const request = useRef(0)
  const latest = useRef({ entries, options })
  latest.current = { entries, options }
  useEffect(() => {
    previous.current = null
    if (typeof Worker === 'undefined') return
    const instance = new Worker(new URL('../workers/translate.worker.ts', import.meta.url), { type: 'module' })
    worker.current = instance
    instance.onmessage = event => { if (event.data.id === request.current) { if (event.data.result) setResult(event.data.result); setSearching(false) } }
    instance.onerror = () => { instance.terminate(); worker.current = null; previous.current = null; setResult(filterTranslations(latest.current.entries, latest.current.options)); setSearching(false) }
    return () => { instance.terminate(); worker.current = null; previous.current = null }
  }, [])
  useEffect(() => {
    const id = ++request.current
    setSearching(true)
    if (!worker.current) { setResult(filterTranslations(entries, options)); setSearching(false); return }
    const before = previous.current
    const patches: Array<[number, SyncEntry]> = []
    if (before && before.length === entries.length) for (let i = 0; i < entries.length; i++) if (entries[i] !== before[i]) patches.push([i, entries[i]])
    // Edits transfer only changed strings; imports/project switches transfer
    // one snapshot. Filtering/sorting of large projects stays off the UI thread.
    worker.current.postMessage(before && before.length === entries.length && patches.length < 2000 ? { id, patches, options } : { id, rows: entries, options })
    previous.current = entries
  }, [entries, options])
  return { result, searching }
}
