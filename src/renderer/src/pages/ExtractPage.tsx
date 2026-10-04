import { FileArchive, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DragDrop } from '@/components/shared/DragDrop'
import { LanguageSelect } from '@/components/shared/LanguageSelect'
import { btnBase, btnPrimary } from '@/features/translate/components/styles'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'

export function ExtractPage(): React.JSX.Element {
  const { t } = useAppTranslation(['extract', 'common', 'toasts'])
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [sourceLang, setSourceLang] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const pickOutput = async () => {
    const folder = await window.api.fs.openFolder()
    if (folder) setOutputPath(folder)
  }

  const handleExtract = async () => {
    if (!inputPath || !outputPath || !sourceLang) return
    setRunning(true)
    setLog([])
    try {
      const result = await window.api.mod.extract({ inputPath, outputPath, sourceLang })
      const lines = [
        t('logs.success'),
        t('logs.foundXml', { count: result.xmlFiles.length }),
        ...result.xmlFiles.map((f) => `  ${f}`)
      ]
      setLog(lines)
      toast.success(t('extract.success', { ns: 'toasts', count: result.xmlFiles.length }))
    } catch (err) {
      const msg = getLocalizedErrorMessage(err, t)
      setLog([t('logs.error', { message: msg })])
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="extract-tool-screen flex min-h-0 flex-col">
      <header className="flex shrink-0 items-center border-b border-neutral-800/50 px-6 py-4">
        <h2 className="text-sm font-medium text-neutral-200">{t('title')}</h2>
      </header>

      <div className="flex flex-col gap-5 px-6 py-6">
        <div className="grid grid-cols-1 items-end gap-5 md:grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)]">
          <LanguageSelect
            label={t('fields.sourceLanguage', { ns: 'common' })}
            value={sourceLang}
            onChange={setSourceLang}
            className="w-full"
          />
          <DragDrop
            accept={['zip', 'pak']}
            onFile={setInputPath}
            label={t('dropLabel')}
            appearance="localization"
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="extract-output-folder" className="text-xs text-neutral-400">
            {t('outputFolder')}
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              id="extract-output-folder"
              value={outputPath}
              placeholder={t('selectOutputFolder')}
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
            onClick={handleExtract}
            disabled={running || !inputPath || !outputPath || !sourceLang}
            className={btnPrimary}
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <FileArchive size={13} aria-hidden="true" />}
            {running ? t('extracting') : t('extract')}
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
