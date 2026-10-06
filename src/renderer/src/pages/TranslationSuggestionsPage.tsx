import { FileText, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import type { SuggestionSource } from '../../../shared/translation-suggestions'

export function TranslationSuggestionsPage({ onReady }: { onReady?: () => void }): React.JSX.Element {
  const [sources, setSources] = useState<SuggestionSource[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<SuggestionSource | null>(null)
  useEffect(() => {
    let mounted = true
    void window.api.translationSuggestions.list()
      .then(result => { if (mounted) setSources(result) })
      .catch(error => toast.error(error instanceof Error ? error.message : String(error)))
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!loading) onReady?.()
  }, [loading, onReady])

  const run = async (operation: () => Promise<SuggestionSource[]>, message?: string): Promise<void> => {
    setBusy(true)
    try {
      setSources(await operation())
      if (message) toast.success(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally { setBusy(false) }
  }

  return (
    <section className="flex min-h-0 flex-col">
      <ConfirmDialog open={pendingRemoval !== null} title="Remove suggestion file"
        description={`Remove ${pendingRemoval?.name ?? 'this file'} from translation suggestions? Your original file will not be changed.`}
        confirmLabel="Remove" destructive
        onClose={() => setPendingRemoval(null)}
        onConfirm={async () => {
          if (!pendingRemoval || busy) return
          const id = pendingRemoval.id
          setPendingRemoval(null)
          await run(() => window.api.translationSuggestions.remove({ id }), 'Suggestion file removed.')
        }} />
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800/50 px-6 py-4">
        <h2 className="text-sm font-medium text-neutral-200">Translation suggestions</h2>
        <span className="font-mono text-[11px] text-neutral-600">
          {loading ? 'Loading…' : `${sources.length} ${sources.length === 1 ? 'File' : 'Files'}`}
        </span>
      </header>
      <div className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-neutral-200">Suggestion files</h3>
          <p className="mt-1 text-xs leading-5 text-neutral-500">Choose which XML files provide suggestions in Translate. Disabled files stay available to enable again.</p>
        </div>
      {loading ? <div className="flex items-center gap-2 py-5 text-xs text-neutral-500"><Loader2 size={14} className="animate-spin" /> Loading files…</div>
        : sources.length === 0 ? <div className="rounded-lg border border-neutral-800 p-6 text-center text-sm text-neutral-500">No suggestion files. Add a localization XML to get started.</div>
        : <div className="space-y-2">{sources.map(source => (
          <div key={source.id} className="flex items-center gap-3 rounded-lg border border-neutral-800/80 bg-transparent px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-800/40 text-neutral-400"><FileText size={17} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-neutral-200" title={source.name}>{source.name}</div>
              <div className="text-xs text-neutral-500">{!source.available ? 'File unavailable' : source.enabled ? 'Enabled' : 'Disabled — kept for later'}</div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
              <input type="checkbox" checked={source.enabled} disabled={busy || !source.available}
                aria-label={`Enable suggestions from ${source.name}`}
                onChange={event => void run(() => window.api.translationSuggestions.setEnabled({ id: source.id, enabled: event.target.checked }))}
                style={{ accentColor: 'var(--poly-accent)' }} className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed" />
              Enabled
            </label>
            <button type="button" disabled={busy} title={`Remove ${source.name}`} aria-label={`Remove ${source.name}`}
              onClick={() => setPendingRemoval(source)}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-neutral-500 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-45"><Trash2 size={15} /></button>
          </div>
        ))}</div>}
      </div>
      <footer className="flex shrink-0 items-center justify-end border-t border-neutral-800/50 px-6 py-4">
        <button type="button" disabled={busy || loading}
          onClick={() => void run(() => window.api.translationSuggestions.add())}
          className="accent-solid-control inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add files
        </button>
      </footer>
    </section>
  )
}
