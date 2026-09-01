import { Apple, CheckCircle2, HardDriveDownload, Monitor, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslationSession } from '@/context/TranslationSession'
import type { Language } from '@/types'
import { ExportControls } from '@/features/translate/components/ExportControls'
import { PackageExportModal } from '@/features/translate/components/PackageExportModal'
import { useTranslationExport } from '@/features/translate/hooks/useTranslationExport'

type TargetPlatform = 'windows' | 'macos'

export function InjectLocalizationPage({ embedded = false }: { embedded?: boolean }): React.JSX.Element {
  const session = useTranslationSession()
  const [running, setRunning] = useState<TargetPlatform | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [languages, setLanguages] = useState<Language[]>([])
  const isMacOS = navigator.platform.toLowerCase().includes('mac')
  const exportFlow = useTranslationExport(session, languages)

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
  }, [])

  const inject = async (platform: TargetPlatform) => {
    if (session.phase !== 'loaded' || session.entries.length === 0) {
      toast.error('Load a localization XML in Translate first.')
      return
    }

    setRunning(platform)
    setResult(null)
    try {
      const response = await window.api.mod.injectLocalizationPak({ platform, entries: session.entries })
      const backupMessage = response.backupCreated
        ? 'English.pak was backed up as EnglishOld.pak.bak.'
        : 'EnglishOld.pak.bak already existed, so the existing backup was preserved.'
      setResult(`${response.pakPath} — ${backupMessage}`)
      toast.success('English.pak injected successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setResult(message)
      toast.error(message)
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className={`inject-localization-page flex min-h-0 flex-col overflow-y-auto text-neutral-200 ${embedded ? 'inject-localization-page-embedded h-auto p-0' : 'h-full p-8'}`}>
      <div className={embedded ? 'w-full' : 'mx-auto w-full max-w-4xl'}>
        <div className="mb-7 flex items-start gap-3">
          <HardDriveDownload className="mt-1 text-amber-400" size={24} />
          <div>
            <h1 className="text-2xl font-semibold">Inject Localization</h1>
            <p className="mt-1 text-sm text-neutral-500">Build the current translation and install it as the game&apos;s English.pak.</p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-neutral-300">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-300"><ShieldCheck size={16} /> Safe replacement</div>
          <p className="leading-6 text-neutral-400">The first injection renames the original English.pak to EnglishOld.pak.bak (so the game will not load the backup). Later injections keep that backup and replace only the active English.pak.</p>
        </div>

        {session.phase !== 'loaded' ? (
          <div className="rounded-xl border border-[#1f2329] bg-[#131518] p-6 text-sm text-neutral-500">Load a localization XML in Translate first.</div>
        ) : (
          <>
            <div className="mb-4 text-xs text-neutral-500">{session.entries.length.toLocaleString()} entries ready from {session.modName || 'the current XML'}.</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <button type="button" disabled={running !== null || isMacOS} onClick={() => { if (!isMacOS) void inject('windows') }} className="group rounded-xl border border-[#2a2f37] bg-[#131518] p-5 text-left transition-colors hover:border-amber-500/40 hover:bg-amber-500/5 disabled:cursor-wait disabled:opacity-60">
                <div className="mb-4 flex items-center justify-between"><Monitor size={24} className="text-amber-400" />{running === 'windows' ? <span className="text-xs text-amber-300">Injecting…</span> : <span className="text-xs text-neutral-600">Windows</span>}</div>
                <div className="font-medium">Inject for Windows</div>
                <div className="mt-1 text-xs leading-5 text-neutral-500">Steam / Baldurs Gate 3 / Data / Localization</div>
                <span className="mt-5 inline-flex rounded-md bg-amber-500/90 px-4 py-2 text-xs font-semibold text-neutral-950">{running === 'windows' ? 'Injecting…' : isMacOS ? 'Unavailable on macOS' : 'Inject English.pak'}</span>
              </button>
              <button type="button" disabled={running !== null || !isMacOS} onClick={() => { if (isMacOS) void inject('macos') }} className="group rounded-xl border border-[#2a2f37] bg-[#131518] p-5 text-left transition-colors hover:border-amber-500/40 hover:bg-amber-500/5 disabled:cursor-not-allowed disabled:opacity-60">
                <div className="mb-4 flex items-center justify-between"><Apple size={24} className="text-amber-400" /><span className="text-xs text-neutral-600">macOS</span></div>
                <div className="font-medium">Inject for macOS</div>
                <div className="mt-1 text-xs leading-5 text-neutral-500">Builds the localization PAK natively for macOS.</div>
                <span className="mt-5 inline-flex rounded-md bg-amber-500/90 px-4 py-2 text-xs font-semibold text-neutral-950">{running === 'macos' ? 'Injecting…' : isMacOS ? 'Inject English.pak' : 'Unavailable on Windows'}</span>
              </button>
            </div>
            <div className="mt-4 w-full rounded-xl border border-[#2a2f37] bg-[#131518] p-4 shadow-[0_3px_0_#0b0d0f]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-200">Export current translation</div>
                  <div className="mt-1 text-xs text-neutral-500">Create XML, PAK or ZIP from the loaded session.</div>
                </div>
                <HardDriveDownload size={18} className="shrink-0 text-amber-400" />
              </div>
              <ExportControls exportFormat={exportFlow.exportFormat} onFormatChange={exportFlow.setExportFormat} onExport={exportFlow.openExport} onPakExport={exportFlow.exportPak} />
            </div>
          </>
        )}

        {result && <div className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-200"><CheckCircle2 size={15} className="mt-0.5 shrink-0" /><span className="break-all">{result}</span></div>}
      </div>
      {exportFlow.exportMeta && <PackageExportModal meta={exportFlow.exportMeta} languages={languages} selectedLanguageFolder={exportFlow.bg3LanguageFolder} isExporting={exportFlow.isExporting} onCancel={exportFlow.closeExportModal} onSubmit={exportFlow.submitPackageExport} />}
    </div>
  )
}
