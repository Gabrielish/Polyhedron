import { CheckCircle2, CloudCog, CloudOff, Download, LoaderCircle, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslationSession } from '@/context/TranslationSession'
import { useConfig } from '@/hooks/useConfig'
import { getTermGlossaryStorageKey, loadTermGlossary } from '@/utils/termGlossary'

type SyncResult = {
  direction: 'upload' | 'download'
  translated: number
  total: number
  fingerprint: string
}

function formatSyncDate(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date)
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes > 0 ? `${minutes}m ${String(remainder).padStart(2, '0')}s` : `${remainder}s`
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes > 0 ? `${minutes}m ${String(remainder).padStart(2, '0')}s` : `${remainder}s`
}

function fingerprint(
  entries: Array<{
    uid: string
    target: string
    genderTargets?: Partial<Record<'default' | 'female' | 'neutral', string>>
    matchType: string
    needsReview: boolean
    reviewStatus?: string
    history?: unknown
  }>
): string {
  let hash = 2166136261
  for (const entry of entries) {
    const value = `${entry.uid}\u0000${entry.target}\u0000${JSON.stringify(entry.genderTargets ?? {})}\u0000${entry.matchType}\u0000${entry.needsReview}\u0000${entry.reviewStatus ?? ''}\u0000${JSON.stringify(entry.history ?? [])}`
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
  const [busyAction, setBusyAction] = useState<'upload' | 'download' | null>(null)
  const [busyStartedAt, setBusyStartedAt] = useState<number | null>(null)
  const [busyElapsed, setBusyElapsed] = useState(0)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  useEffect(() => {
    if (!syncResult) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSyncResult(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [syncResult])
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null)
  const [lastUploadedAt, setLastUploadedAt] = useState<string | null>(null)
  const [lastDownloadedAt, setLastDownloadedAt] = useState<string | null>(null)
  const [autoSyncBlocked, setAutoSyncBlocked] = useState(false)
  const [autoSyncStatus, setAutoSyncStatus] = useState<string | null>(null)
  const [autoSyncNextAt, setAutoSyncNextAt] = useState<number | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const [remoteChanged, setRemoteChanged] = useState(false)
  const session = useTranslationSession()
  const { config } = useConfig()
  const sessionRef = useRef(session)
  sessionRef.current = session
  const autoSyncStateRef = useRef({
    busy: false,
    remoteChanged: false,
    autoSyncBlocked: false,
    savedFingerprint: null as string | null,
    currentFingerprint: ''
  })
  const uploadRef = useRef<((showResult?: boolean, automatic?: boolean) => Promise<void>) | null>(null)
  const sessionKey = `${session.storedPath ?? session.inputPath ?? session.modName}|${session.sourceLang}|${session.targetLang}`
  const termGlossaryKey = getTermGlossaryStorageKey(
    session.storedPath ?? session.inputPath ?? session.modName ?? 'current',
    session.sourceLang,
    session.targetLang
  )
  // The workspace importer can rewrite stored/input paths. Keep the UI's saved
  // fingerprint keyed by the stable session identity so Download remains
  // "Synced" after the imported workspace is loaded or the app is restarted.
  const syncKey = `polyhedron.cloud-sync.${session.modName}|${session.sourceLang}|${session.targetLang}`
  const lastUploadedKey = `${syncKey}.last-uploaded`
  const lastDownloadedKey = `${syncKey}.last-downloaded`
  const lastUploadedTranslatedKey = `${syncKey}.last-uploaded-translated`
  const globalLastUploadedKey = 'polyhedron.cloud-sync.last-uploaded'
  const globalLastDownloadedKey = 'polyhedron.cloud-sync.last-downloaded'
  const currentFingerprint = useMemo(
    () =>
      fingerprint(
        session.entries.map(
          ({ uid, target, genderTargets, matchType, needsReview, reviewStatus, history }) => ({
            uid,
            target,
            genderTargets,
            matchType,
            needsReview,
            reviewStatus,
            history
          })
        )
      ),
    [session.entries]
  )
  const autoSyncIntervalMinutes = Number(config['cloud_auto_sync_interval'] ?? '0')
  const autoSyncEnabled = Number.isFinite(autoSyncIntervalMinutes) && autoSyncIntervalMinutes > 0
  const translatedCount = useMemo(
    () => session.entries.filter((entry) => entry.target.trim().length > 0).length,
    [session.entries]
  )

  useEffect(() => {
    if (!busy || busyStartedAt === null) return
    const updateElapsed = () => setBusyElapsed(Math.floor((Date.now() - busyStartedAt) / 1000))
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(timer)
  }, [busy, busyStartedAt])
  autoSyncStateRef.current = {
    busy,
    remoteChanged,
    autoSyncBlocked,
    savedFingerprint,
    currentFingerprint
  }

  useEffect(() => {
    setSavedFingerprint(localStorage.getItem(syncKey))
    setLastUploadedAt(localStorage.getItem(lastUploadedKey))
    setLastDownloadedAt(localStorage.getItem(lastDownloadedKey))
    setAutoSyncBlocked(false)
  }, [lastDownloadedKey, lastUploadedKey, syncKey])

  const loadedOnce = useRef(session.phase === 'loaded')
  useEffect(() => {
    if (session.phase !== 'loaded') {
      loadedOnce.current = false
      return
    }
    if (loadedOnce.current) return
    loadedOnce.current = true
    if (localStorage.getItem(syncKey) !== 'download-pending') return
    // The imported workspace is now loaded; use the fingerprint of the actual
    // in-memory session rather than the pre-restart archive fingerprint.
    localStorage.setItem(syncKey, currentFingerprint)
    setSavedFingerprint(currentFingerprint)
  }, [currentFingerprint, session.phase, syncKey])

  const remoteStampKey = `polyhedron.cloud-sync-remote.${syncKey}`
  const isSynced =
    session.phase === 'loaded' &&
    !remoteChanged &&
    savedFingerprint !== null &&
    savedFingerprint === currentFingerprint

  useEffect(() => {
    if (session.phase !== 'loaded') return
    // Do not trigger Google's interactive auth just because a session is open;
    // polling starts only after this session has already been synced once.
    if (!localStorage.getItem(syncKey)) return
    let cancelled = false
    const checkRemote = async () => {
      try {
        if (busy) return
        const stamp = await window.api.cloud.syncStamp()
        if (cancelled || autoSyncStateRef.current.busy || !stamp) return
        const previous = localStorage.getItem(remoteStampKey)
        if (!previous) {
          localStorage.setItem(remoteStampKey, stamp)
        } else if (previous !== stamp) {
          // A remote change is only dangerous when this workspace also has
          // unsynced local edits. If local state is already synced, advance the
          // baseline instead of leaving auto-sync paused forever.
          if (savedFingerprint !== null && savedFingerprint === currentFingerprint) {
            localStorage.setItem(remoteStampKey, stamp)
            setRemoteChanged(false)
          } else {
            setRemoteChanged(true)
          }
        }
      } catch {
        /* Keep the current status when Drive is temporarily unavailable. */
      }
    }
    void checkRemote()
    const timer = window.setInterval(() => void checkRemote(), 5 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [busy, currentFingerprint, remoteStampKey, savedFingerprint, session.phase])

  useEffect(() => {
    if (!autoSyncEnabled || session.phase !== 'loaded') {
      setAutoSyncNextAt(null)
      return
    }

    // Re-arm the scheduler after changing the interval. A previous false
    // remote-change signal must not permanently latch the timer in pause.
    setRemoteChanged(false)
    setAutoSyncStatus(null)
    let nextAt = Date.now() + autoSyncIntervalMinutes * 60 * 1000
    setAutoSyncNextAt(nextAt)
    const timer = window.setInterval(() => {
      const now = Date.now()
      setClock(now)
      if (now < nextAt) return

      const state = autoSyncStateRef.current
      nextAt = now + autoSyncIntervalMinutes * 60 * 1000
      setAutoSyncNextAt(nextAt)
      if (
        state.busy ||
        state.remoteChanged ||
        state.autoSyncBlocked ||
        state.savedFingerprint === state.currentFingerprint
      ) {
        setAutoSyncStatus(
          state.busy
            ? 'Waiting for the current sync to finish'
            : state.remoteChanged
              ? 'Paused: Drive changed remotely'
              : state.autoSyncBlocked
                ? 'Paused: review required'
                : 'No local changes'
        )
        return
      }
      setAutoSyncStatus('Preparing upload…')
      void uploadRef.current?.(false, true)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [autoSyncEnabled, autoSyncIntervalMinutes, session.phase])

  async function saveCurrentSession(): Promise<void> {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    const latest = sessionRef.current
    if (latest.phase !== 'loaded' || latest.entries.length === 0) return
    const sessionKey = `${latest.storedPath ?? latest.inputPath ?? latest.modName}|${latest.sourceLang}|${latest.targetLang}`
    await window.api.session.save({
      key: sessionKey,
      entries: latest.entries.map(
        ({ uid, target, genderTargets, matchType, needsReview, reviewStatus, history }) => ({
          uid,
          target,
          genderTargets,
          matchType,
          needsReview,
          reviewStatus,
          history
        })
      )
    })
  }

  async function upload(showResult = true, automatic = false): Promise<void> {
    setBusy(true)
    setBusyAction('upload')
    setBusyStartedAt(Date.now())
    if (automatic) setAutoSyncStatus('Uploading workspace…')
    try {
      if (automatic) {
        const lastUploadedTranslated = Number(
          localStorage.getItem(lastUploadedTranslatedKey) ?? ''
        )
        if (
          Number.isFinite(lastUploadedTranslated) &&
          lastUploadedTranslated > 0 &&
          translatedCount < lastUploadedTranslated
        ) {
          setAutoSyncBlocked(true)
          setAutoSyncStatus('Paused: review required')
          toast.warning(
            `Automatic upload paused: local workspace has ${translatedCount.toLocaleString()} translated entries, but the last uploaded version had ${lastUploadedTranslated.toLocaleString()}.`
          )
          return
        }
        const cloudStatus = await window.api.cloud.status()
        // Compare the same metadata file on both sides. The workspace archive
        // and the lightweight sync document are uploaded separately and can
        // legitimately have different Drive modified times.
        const stamp = await window.api.cloud.syncStamp()
        const previousStamp = localStorage.getItem(remoteStampKey)
        if (
          cloudStatus.translated !== null &&
          translatedCount < cloudStatus.translated
        ) {
          setAutoSyncBlocked(true)
          setAutoSyncStatus('Paused: Drive has more translations')
          toast.warning(
            `Automatic upload paused: local workspace has ${translatedCount.toLocaleString()} translated entries, but Drive has ${cloudStatus.translated.toLocaleString()}.`
          )
          return
        }
        if (stamp && !previousStamp) {
          localStorage.setItem(remoteStampKey, stamp)
        }
        if (stamp && previousStamp && previousStamp !== stamp) {
          setRemoteChanged(true)
          setAutoSyncStatus('Paused: Drive changed remotely')
          return
        }
      }
      await saveCurrentSession()
      const result = await window.api.cloud.upload({
        sessionKey,
        termGlossary: {
          key: termGlossaryKey,
          entries: loadTermGlossary(termGlossaryKey)
        }
      })
      // The in-memory session is the source of truth for the status badge. The
      // workspace archive may normalize its persisted payload, so comparing its
      // service-side fingerprint directly can leave a successful upload marked
      // as unsynced even though the current UI state was uploaded.
      localStorage.setItem(syncKey, currentFingerprint)
      setSavedFingerprint(currentFingerprint)
      const uploadedAt = result.modifiedTime ?? new Date().toISOString()
      localStorage.setItem(lastUploadedKey, uploadedAt)
      localStorage.setItem(globalLastUploadedKey, uploadedAt)
      localStorage.setItem(lastUploadedTranslatedKey, String(translatedCount))
      setLastUploadedAt(uploadedAt)
      setAutoSyncBlocked(false)
      const stamp = await window.api.cloud.syncStamp()
      if (stamp) localStorage.setItem(remoteStampKey, stamp)
      setRemoteChanged(false)
      if (showResult) {
        setSyncResult({ direction: 'upload', ...result.stats })
        setOpen(false)
      }
      void window.api.window.notifySyncComplete({ direction: 'upload', ...result.stats })
      if (automatic) {
        setAutoSyncStatus('Last automatic sync completed')
        toast.success('Automatic Google Drive sync completed.')
      }
    } catch (error) {
      if (automatic) setAutoSyncStatus('Automatic sync failed')
      toast.error(error instanceof Error ? error.message : 'Google Drive upload failed.')
    } finally {
      setBusy(false)
      setBusyAction(null)
      setBusyStartedAt(null)
      setBusyElapsed(0)
    }
  }

  uploadRef.current = upload

  async function download(): Promise<void> {
    setBusy(true)
    setBusyAction('download')
    setBusyStartedAt(Date.now())
    try {
      const result = await window.api.cloud.download({ sessionKey, termGlossaryKey })
      if (result.termGlossary) {
        localStorage.setItem(termGlossaryKey, JSON.stringify(result.termGlossary))
      }
      localStorage.setItem(syncKey, 'download-pending')
      setSavedFingerprint('download-pending')
      const downloadedAt = new Date().toISOString()
      localStorage.setItem(lastDownloadedKey, downloadedAt)
      localStorage.setItem(globalLastDownloadedKey, downloadedAt)
      setLastDownloadedAt(downloadedAt)
      const stamp = await window.api.cloud.syncStamp()
      if (stamp) localStorage.setItem(remoteStampKey, stamp)
      setRemoteChanged(false)
      setSyncResult({ direction: 'download', ...result.stats })
      setOpen(false)
      void window.api.window.notifySyncComplete({ direction: 'download', ...result.stats })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google Drive download failed.')
    } finally {
      setBusy(false)
      setBusyAction(null)
      setBusyStartedAt(null)
      setBusyElapsed(0)
    }
  }

  return (
    <div
      className="pointer-events-auto relative z-[110] mr-2 flex items-center gap-1"
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
        className={`cloud-sync-button pointer-events-auto relative flex h-7 items-center gap-1.5 overflow-hidden rounded-md border px-2.5 text-[11px] font-semibold transition disabled:opacity-60 ${
          isSynced
            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
            : 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
        }`}
      >
        {busy ? (
          <LoaderCircle size={13} className="animate-spin" />
        ) : isSynced ? (
          <CheckCircle2 size={13} />
        ) : (
          <CloudOff size={13} />
        )}
        {busy
          ? busyAction === 'upload'
            ? 'Uploading…'
            : busyAction === 'download'
              ? 'Downloading…'
              : 'Syncing…'
          : isSynced
            ? 'Synced'
            : 'Not synced'}
        {busy && <span className="ml-auto font-mono text-[10px] tabular-nums opacity-75">{formatElapsed(busyElapsed)}</span>}
        {busy && (
          <span className="cloud-sync-loading-track pointer-events-none absolute inset-x-0 bottom-0 h-0.5">
            <span className="cloud-sync-loading-bar block h-full w-1/3 rounded-full bg-current" />
          </span>
        )}
      </button>

      {open && !busy && (
        <div className="pointer-events-auto absolute top-8 right-0 z-[200] inline-flex w-max max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-[#343941] bg-[#171a1f] p-1.5 shadow-xl">
          {autoSyncEnabled && (
            <div className="mb-1 flex items-start gap-2 rounded-md border-b border-[#2a2f37] px-2.5 py-2.5">
              <CloudCog size={15} className="mt-0.5 shrink-0 text-violet-300" />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-neutral-200">Auto-sync active</span>
                <span className="mt-0.5 block text-[10px] text-neutral-500">
                  Next sync in{' '}
                  <span className="font-mono tabular-nums text-neutral-400">
                    {autoSyncNextAt === null ? '—' : formatRemaining(autoSyncNextAt - clock)}
                  </span>
                </span>
                {autoSyncStatus && (
                  <span className="mt-0.5 block max-w-56 truncate text-[10px] text-amber-300/70">
                    {autoSyncStatus}
                  </span>
                )}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => void upload()}
            className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-xs whitespace-nowrap text-neutral-200 hover:bg-white/8"
          >
            <Upload size={14} className="text-amber-300" />
            <span className="min-w-0">
              <span className="block">Upload workspace</span>
              <span className="mt-0.5 block text-[10px] text-neutral-500">
                Last uploaded: {formatSyncDate(lastUploadedAt)}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => void download()}
            className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-xs whitespace-nowrap text-neutral-200 hover:bg-white/8"
          >
            <Download size={14} className="text-amber-300" />
            <span className="min-w-0">
              <span className="block">Download workspace</span>
              <span className="mt-0.5 block text-[10px] text-neutral-500">
                Last downloaded: {formatSyncDate(lastDownloadedAt)}
              </span>
            </span>
          </button>
          {autoSyncBlocked && (
            <div className="mx-2 mt-1 rounded-md border border-amber-500/25 bg-amber-500/8 px-2.5 py-2 text-[10px] leading-4 text-amber-200/80">
              Automatic upload paused because this workspace has fewer translated entries than
              the last uploaded version.
            </div>
          )}
        </div>
      )}

      {syncResult && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/55"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="w-[360px] overflow-hidden rounded-2xl border border-[#34343e] bg-[#15161b] shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between border-b border-[#2b2e36] px-4 py-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
                {syncResult.direction === 'download' ? (
                  <Download size={17} className="text-amber-300" />
                ) : (
                  <Upload size={17} className="text-amber-300" />
                )}
                {syncResult.direction === 'download'
                  ? 'Workspace downloaded'
                  : 'Workspace uploaded'}
              </div>
              <button
                type="button"
                onClick={() => setSyncResult(null)}
                aria-label="Close"
                className="rounded-lg border border-[#34343e] p-1.5 text-neutral-400 transition-colors hover:border-neutral-500 hover:bg-white/5 hover:text-neutral-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <p className="m-0 text-sm leading-5 text-neutral-400">
                {syncResult.direction === 'download'
                  ? 'The cloud workspace was imported successfully.'
                  : 'The current workspace was saved to Google Drive successfully.'}
              </p>
              <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-sm">
                <span className="font-semibold text-amber-300">
                  {syncResult.translated.toLocaleString()}
                </span>
                <span className="text-neutral-400">
                  {' '}
                  / {syncResult.total.toLocaleString()} entries translated
                </span>
              </div>
              {syncResult.direction === 'download' && (
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void window.api.window.relaunch()}
                    className="rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400"
                  >
                    Restart now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
