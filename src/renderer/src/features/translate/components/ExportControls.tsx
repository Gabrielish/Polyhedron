import { Archive, Download } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import type { ExportFormat } from '../types'
import { btnPrimary } from './styles'

interface ExportControlsProps {
  exportFormat: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  onExport: () => Promise<void>
  onPakExport: () => Promise<void>
  packageExportEnabled?: boolean
}

export function ExportControls({
  exportFormat,
  onFormatChange,
  onExport,
  onPakExport,
  packageExportEnabled = true
}: ExportControlsProps): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'common'])

  return (
    <div className="flex items-center gap-1.5">
      <ThemedSelect
        value={exportFormat}
        onChange={(value) => onFormatChange(value as ExportFormat)}
        className="w-36"
        triggerClassName="h-[30px] border-neutral-700 bg-[#131518] px-3 text-xs text-neutral-200 hover:border-neutral-600"
        menuClassName="border-neutral-700"
        options={[
          { value: 'xml', label: 'xml' },
          ...(packageExportEnabled
            ? [{ value: 'pak', label: 'pak' }, { value: 'zip', label: 'zip' }]
            : [])
        ]}
      />
      <button
        type="button"
        className={btnPrimary}
        onClick={onPakExport}
        disabled={!packageExportEnabled}
        title="Create English.pak"
      >
        <Archive />
        PAK
      </button>
      <button
        type="button"
        className={btnPrimary}
        onClick={onExport}
        title={t('actions.export', { ns: 'common' })}
      >
        <Download />
        {t('actions.export', { ns: 'common' })}
      </button>
    </div>
  )
}
