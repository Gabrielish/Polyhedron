import { CheckCircle2, CloudOff, Download, LoaderCircle, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslationSession } from '@/context/TranslationSession'

type SyncResult = {
  direction: 'upload' | 'download'
  translated: number
  total: number
  fingerprint: string
}

function fingerprint(entries: Array<{ uid: string; target: string; matchType: string; needsReview: boolean }>): string {
  let hash = 2166136261
  for (const entry of entries) {
    const value = `${entry.uid}\u0000${entry.target}\u0000${entry.matchType}\u0000${entry.needsReview}`
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
  }
  return (hash >>> 0).toString(16)
}

export function CloudSyncMenu(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null)
  const session = useTranslationSession()
  const sessionKey = `${session.storedPath ?? session.inputPath ?? session.modName}|${session.sourceLang}|${session.targetLang}`
  // The workspace importer can rewrite stored/input paths. Keep the UI's saved
  // fingerprint keyed by the stable session identity so Download remains
  // "Synced" after the imported workspace is loaded or the app is restarted.
  const syncKey = `icosa.cloud-sync.${session.modName}|${session.sourceLang}|${session.targetLang}`
  const currentFingerprint = useMemo(
    () => fingerprint(session.entries.map(({ uid, target, matchType, needsReview }) => ({ uid, target, matchType, needsReview }))),
    [session.entries]
  )

  useEffect(() => {
    setSavedFingerprint(localStorage.getItem(syncKey))
  }, [syncKey])

  const isSynced = session.phase === 'loaded' && savedFingerprint !== null && savedFingerprint === currentFingerprint

  async function saveCurrentSession(): Promise<void> {
    if (session.phase !== 'loaded' || session.entries.length === 0) return
    const sessionKey = `${session.storedPath ?? session.inputPath ?? session.modName}|${session.sourceLang}|${session.targetLang}`
    await window.api.session.save({
      key: sessionKey,
      entries: session.entries.map(({ uid, target, matchType, needsReview }) => ({ uid, target, matchType, needsReview }))
    })
  }

  async function upload(): Promise<void> {
    setBusy(true)
    try {
      await saveCurrentSession()
      const result = await window.api.cloud.upload({ sessionKey })
      localStorage.setItem(syncKey, result.stats.fingerprint || currentFingerprint)
      setSavedFingerprint(result.stats.fingerprint || currentFingerprint)
      setSyncResult({ direction: 'upload', ...result.stats })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google Drive upload failed.')
    } finally {
      setBusy(false)
    }
  }

  async function download(): Promise<void> {
    setBusy(true)
    try {
      const result = await window.api.cloud.download({ sessionKey })
      localStorage.setItem(syncKey, result.stats.fingerprint)
      setSavedFingerprint(result.stats.fingerprint)
      setSyncResult({ direction: 'download', ...result.stats })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google Drive download failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="pointer-events-auto relative z-[110] mr-2"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        title="Google Drive cloud sync"
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
        className={`pointer-events-auto flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition disabled:opacity-60 ${
          isSynced
            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
            : 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
        }`}
      >
        {busy ? <LoaderCircle size={13} className="animate-spin" /> : isSynced ? <CheckCircle2 size={13} /> : <CloudOff size={13} />}
        {busy ? 'Syncing…' : isSynced ? 'Synced' : 'Not synced'}
      </button>

      {open && !busy && (
        <div className="pointer-events-auto absolute top-8 right-0 z-[200] w-44 rounded-lg border border-[#343941] bg-[#171a1f] p-1.5 shadow-xl">
          <button
            type="button"
            onClick={() => void upload()}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-neutral-200 hover:bg-white/8"
          >
            <Upload size={14} className="text-amber-300" />
            Upload workspace
          </button>
          <button
            type="button"
            onClick={() => void download()}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-neutral-200 hover:bg-white/8"
          >
            <Download size={14} className="text-amber-300" />
            Download workspace
          </button>
        </div>
      )}

      {syncResult && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/55" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="w-[360px] rounded-xl border border-[#3a3f47] bg-[#171a1f] p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
              {syncResult.direction === 'download' ? <Download size={17} className="text-amber-300" /> : <Upload size={17} className="text-amber-300" />}
              {syncResult.direction === 'download' ? 'Workspace downloaded' : 'Workspace uploaded'}
            </div>
            <p className="mt-3 text-sm leading-5 text-neutral-400">
              {syncResult.direction === 'download'
                ? 'The cloud workspace was imported successfully.'
                : 'The current workspace was saved to Google Drive successfully.'}
            </p>
            <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-sm">
              <span className="font-semibold text-amber-300">{syncResult.translated.toLocaleString()}</span>
              <span className="text-neutral-400"> / {syncResult.total.toLocaleString()} entries translated</span>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              {syncResult.direction === 'download' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSyncResult(null)}
                    className="rounded-md border border-[#3a3f47] px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/5"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    onClick={() => void window.api.window.relaunch()}
                    className="rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400"
                  >
                    Restart now
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSyncResult(null)}
                  className="rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
