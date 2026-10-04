import { PackagePlus, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { btnBase, btnPrimary } from '@/features/translate/components/styles'
import { cn } from '@/lib/utils'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'

export function PackagePage(): React.JSX.Element {
  const { t } = useAppTranslation(['package', 'common', 'toasts'])
  const [inputFolder, setInputFolder] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const pickInput = async () => {
    const folder = await window.api.fs.openFolder()
    if (folder) setInputFolder(folder)
  }

  const pickOutput = async () => {
    const file = await window.api.fs.saveDialog({
      defaultName: 'mod.pak',
      filters: [{ name: 'PAK files', extensions: ['pak'] }]
    })
    if (file) setOutputPath(file)
  }

  const handlePack = async () => {
    if (!inputFolder || !outputPath) return
    setRunning(true)
    setLog([])
    try {
      const result = await window.api.mod.pack({ inputFolder, outputPath })
      setLog([t('logs.created', { path: result.pakPath })])
      toast.success(t('package.success', { ns: 'toasts' }))
    } catch (err) {
      const msg = getLocalizedErrorMessage(err, t)
      setLog([t('logs.error', { message: msg })])
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="package-tool-screen flex min-h-0 flex-col">
      <header className="flex shrink-0 items-center border-b border-neutral-800/50 px-6 py-4">
        <h2 className="text-sm font-medium text-neutral-200">{t('title')}</h2>
      </header>

      <div className="flex flex-col gap-5 px-6 py-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="package-input-folder" className="text-xs text-neutral-400">
            {t('inputFolder')}
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              id="package-input-folder"
              value={inputFolder}
              placeholder={t('selectInputFolder')}
              className="flex-1 rounded-md border border-[#1f2329] bg-transparent px-3 py-2 text-sm text-neutral-400 outline-none"
            />
            <button type="button" onClick={pickInput} className={`${btnBase} h-[34px]`}>
              {t('actions.browse', { ns: 'common' })}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="package-output-file" className="text-xs text-neutral-400">
            {t('outputFile')}
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              id="package-output-file"
              value={outputPath}
              placeholder={t('saveAsPak')}
              className="flex-1 rounded-md border border-[#1f2329] bg-transparent px-3 py-2 text-sm text-neutral-400 outline-none"
            />
            <button type="button" onClick={pickOutput} className={`${btnBase} h-[34px]`}>
              {t('actions.browse', { ns: 'common' })}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handlePack}
            disabled={running || !inputFolder || !outputPath}
            className={cn(btnPrimary, (running || !inputFolder || !outputPath) && 'cursor-not-allowed opacity-40')}
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <PackagePlus size={13} aria-hidden="true" />}
            {running ? t('creating') : t('create')}
          </button>
        </div>

        {log.length > 0 && (
          <div className="rounded-lg border border-[#1f2329] bg-transparent p-3 font-mono text-xs text-neutral-300">
            {log.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
