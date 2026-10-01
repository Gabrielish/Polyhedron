import { Archive, FileDown, FileUp, FolderSync, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { InjectLocalizationPage } from './InjectLocalizationPage'
import { ModsPage } from './ModsPage'

export function WorkspacePage(): React.JSX.Element {
  const TitleIcon = FolderSync
  const [running, setRunning] = useState<'import' | 'export' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [importedStats, setImportedStats] = useState<{ translated: number; total: number } | null>(
    null
  )
  useEffect(() => {
    if (!importedStats) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImportedStats(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [importedStats])

  const exportWorkspace = async () => {
    const outputPath = await window.api.fs.saveDialog({
      defaultName: 'PolyhedronWorkspace.pws',
      filters: [{ name: 'Polyhedron Workspace', extensions: ['pws', 'zip'] }]
    })
    if (!outputPath) return
    setRunning('export')
    setMessage(null)
    try {
      await window.api.workspace.export({ outputPath })
      setMessage(`Workspace exported to ${outputPath}`)
      toast.success('Workspace exported successfully.')
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      setMessage(text)
      toast.error(text)
    } finally {
      setRunning(null)
    }
  }

  const importWorkspace = async () => {
    const files = await window.api.fs.openDialog({
      filters: [{ name: 'Polyhedron Workspace', extensions: ['pws', 'zip'] }]
    })
    const inputPath = files[0]
    if (!inputPath) return
    if (
      !window.confirm(
        'Importing a workspace will replace the current Polyhedron database. A backup will be created first. Continue?'
      )
    )
      return
    setRunning('import')
    setMessage(null)
    try {
      const result = await window.api.workspace.import({ inputPath })
      setImportedStats(result.stats)
      setMessage(`Workspace imported. Backup created at ${result.backupPath}.`)
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      setMessage(text)
      toast.error(text)
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-8 text-neutral-200">
      <div className="mx-auto w-full max-w-4xl">
        <div className="app-page-header mb-7 flex items-center gap-3">
          <TitleIcon className="text-amber-400" size={20} />
          <div>
            <h1 className="text-2xl font-semibold">Workspace</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Move your translations, dictionary and mod data between Windows and macOS.
            </p>
          </div>
        </div>
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-neutral-300">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <p>
            <strong className="font-medium text-amber-200">Polyhedron data is protected.</strong>{' '}
            Export creates a consistent SQLite backup. Import replaces the current database only
            after saving a timestamped backup.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            disabled={running !== null}
            onClick={() => void importWorkspace()}
            className="rounded-xl border border-[#2a2f37] bg-[#131518] p-5 text-left transition-colors hover:border-amber-500/40 hover:bg-amber-500/5 disabled:cursor-wait disabled:opacity-60"
          >
            <div className="mb-4 flex items-center justify-between">
              <FileDown size={24} className="text-amber-400" />
              <span className="text-xs text-neutral-600">
                {running === 'import' ? 'Importing…' : 'Import'}
              </span>
            </div>
            <div className="font-medium">Import Workspace</div>
            <div className="mt-1 text-xs leading-5 text-neutral-500">
              Restore the Polyhedron database and imported mod data from a .pws file.
            </div>
            <span className="accent-solid-control mt-5 inline-flex rounded-md bg-amber-500/90 px-4 py-2 text-xs font-semibold text-neutral-950">
              {running === 'import' ? 'Importing…' : 'Choose Workspace'}
            </span>
          </button>
          <button
            type="button"
            disabled={running !== null}
            onClick={() => void exportWorkspace()}
            className="rounded-xl border border-[#2a2f37] bg-[#131518] p-5 text-left transition-colors hover:border-amber-500/40 hover:bg-amber-500/5 disabled:cursor-wait disabled:opacity-60"
          >
            <div className="mb-4 flex items-center justify-between">
              <FileUp size={24} className="text-amber-400" />
              <span className="text-xs text-neutral-600">
                {running === 'export' ? 'Exporting…' : 'Export'}
              </span>
            </div>
            <div className="font-medium">Export Workspace</div>
            <div className="mt-1 text-xs leading-5 text-neutral-500">
              Create a portable backup containing the full translation database.
            </div>
            <span className="accent-solid-control mt-5 inline-flex rounded-md bg-amber-500/90 px-4 py-2 text-xs font-semibold text-neutral-950">
              {running === 'export' ? 'Exporting…' : 'Export Workspace'}
            </span>
          </button>
        </div>
        {message && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-[#2a2f37] bg-[#131518] p-4 text-xs text-neutral-300">
            <Archive size={15} className="mt-0.5 shrink-0 text-amber-400" />
            <span className="break-all">{message}</span>
          </div>
        )}

        <div className="mt-4 border-t border-[#1f2329] pt-4">
          <InjectLocalizationPage embedded />
        </div>
        <div className="mt-4 border-t border-[#1f2329] pt-4">
          <ModsPage embedded />
        </div>
      </div>

      {importedStats && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[360px] rounded-2xl border border-[#34343e] bg-[#15161b] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
            <div className="text-sm font-semibold text-neutral-100">Workspace imported</div>
            <p className="mt-3 text-sm leading-5 text-neutral-400">
              The workspace was imported successfully. Restart Polyhedron now to load it?
            </p>
            <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-sm">
              <span className="font-semibold text-amber-300">
                {importedStats.translated.toLocaleString()}
              </span>
              <span className="text-neutral-400">
                {' '}
                / {importedStats.total.toLocaleString()} entries translated
              </span>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportedStats(null)}
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
