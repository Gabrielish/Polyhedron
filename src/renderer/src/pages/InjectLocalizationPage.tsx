import { Apple, CheckCircle2, HardDriveDownload, Monitor } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslationSession } from '@/context/TranslationSession'

type TargetPlatform = 'windows' | 'macos'

export function InjectLocalizationPage({
  embedded = false
}: {
  embedded?: boolean
}): React.JSX.Element {
  const session = useTranslationSession()
  const [running, setRunning] = useState<TargetPlatform | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const isMacOS = navigator.platform.toLowerCase().includes('mac')
  const isBg3Profile = session.gameProfile === 'bg3'

  const inject = async (platform: TargetPlatform) => {
    if (!isBg3Profile) {
      toast.error("Injection is only available for the Baldur's Gate 3 profile.")
      return
    }
    if (session.phase !== 'loaded' || session.entries.length === 0) {
      toast.error('Load a localization XML in Translate first.')
      return
    }

    setRunning(platform)
    setResult(null)
    try {
      const response = await window.api.mod.injectLocalizationPak({
        platform,
        entries: session.entries
      })
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
    <div
      className={`inject-localization-page flex min-h-0 flex-col overflow-y-auto text-neutral-200 ${embedded ? 'inject-localization-page-embedded h-auto p-0' : 'h-full p-8'}`}
    >
      <div className={embedded ? 'w-full' : 'mx-auto w-full max-w-4xl'}>
        <div className="app-page-header mb-8 flex items-center gap-3">
          <HardDriveDownload className="shrink-0 text-amber-400" size={20} />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">Inject Localization</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Install the current translation into the game&apos;s English.pak file.
            </p>
          </div>
        </div>

        {session.phase !== 'loaded' ? (
          <div className="rounded-xl border border-[#1f2329] bg-[#131518] p-6 text-sm text-neutral-500">
            Load a localization XML in Translate first.
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className={`workspace-action-card overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416] p-6 text-left ${isMacOS || !isBg3Profile ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <Monitor size={24} className="text-amber-400" />
                  <span className="text-xs text-neutral-600">Windows</span>
                </div>
                <div className="font-medium">Inject for Windows</div>
                <div className="mt-1 text-xs leading-5 text-neutral-500">
                  Steam / Baldurs Gate 3 / Data / Localization
                </div>
                <button
                  type="button"
                  disabled={running !== null || isMacOS || !isBg3Profile}
                  onClick={() => {
                    if (!isMacOS) void inject('windows')
                  }}
                  className="accent-solid-control mt-5 inline-flex rounded-md border border-amber-500 bg-amber-500 px-4 py-2 text-xs font-semibold transition-colors hover:border-amber-400 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {running === 'windows'
                    ? 'Injecting…'
                    : isMacOS
                      ? 'Unavailable on macOS'
                      : 'Inject English.pak'}
                </button>
              </div>
              <div
                className={`workspace-action-card overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416] p-6 text-left ${!isMacOS || !isBg3Profile ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <Apple size={24} className="text-amber-400" />
                  <span className="text-xs text-neutral-600">macOS</span>
                </div>
                <div className="font-medium">Inject for macOS</div>
                <div className="mt-1 text-xs leading-5 text-neutral-500">
                  Builds the localization PAK natively for macOS.
                </div>
                <button
                  type="button"
                  disabled={running !== null || !isMacOS || !isBg3Profile}
                  onClick={() => {
                    if (isMacOS) void inject('macos')
                  }}
                  className="accent-solid-control mt-5 inline-flex rounded-md border border-amber-500 bg-amber-500 px-4 py-2 text-xs font-semibold transition-colors hover:border-amber-400 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {running === 'macos'
                    ? 'Injecting…'
                    : isMacOS
                      ? 'Inject English.pak'
                      : 'Unavailable on Windows'}
                </button>
              </div>
            </div>
          </>
        )}

        {result && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-200">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            <span className="break-all">{result}</span>
          </div>
        )}
      </div>
    </div>
  )
}
