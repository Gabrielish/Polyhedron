import {
  BarChart2,
  Bug,
  Check,
  CircleArrowDown,
  CircleArrowUp,
  Cloud,
  Copy,
  Download,
  FileText,
  FolderOpen,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  Monitor,
  Palette,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  UserRound
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { AppMessage } from '@/components/shared/AppMessage'
import { AppTooltip } from '@/components/shared/AppTooltip'
import { formatSyncDate } from '@/utils/formatSyncDate'
import { PolyhedronMark } from '@/components/shared/PolyhedronMark'
import { AiProvidersCard, MachineProvidersCard } from '@/features/settings/AiProvidersCard'
import { PromptSlotsCard } from '@/features/settings/PromptSlotsCard'
import { SimilaritySettingsCard } from '@/features/settings/SimilaritySettingsCard'
import { SettingsSectionCard } from '@/features/settings/SettingsSectionCard'
import { MetricsPage } from './MetricsPage'
import { THEMES, useTheme } from '@/context/ThemeContext'
import { AccentColorControl } from '@/features/settings/AccentColorControl'
import { AppIconStyleControl } from '@/features/settings/AppIconStyleControl'
import { btnPrimary } from '@/features/translate/components/styles'
import { useConfig } from '@/hooks/useConfig'
import { SettingsLoadingSkeleton } from '@/components/layout/RouteLoadingSkeleton'
import { i18n } from '@/i18n'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { defaultLanguage, isSupportedLanguage, languageLabels, supportedLanguages } from '@/i18n/languages'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ConfigKey } from '@/types'
import type { UpdateState } from '../../../preload/api-types'

interface SettingFieldProps {
  label: string
  description?: string
  compact?: boolean
  configKey: ConfigKey
  value: string
  onSave: (key: ConfigKey, value: string) => Promise<void>
  type?: string
  placeholder?: string
  saveLabel: string
  savedLabel: string
  successMessage: string
}

type CloudAccount = {
  connected: boolean
  displayName?: string
  emailAddress?: string
  photoLink?: string
  photoDataUrl?: string
}

function SettingField({
  label,
  description,
  compact = false,
  configKey,
  value,
  onSave,
  type = 'text',
  placeholder,
  saveLabel,
  savedLabel,
  successMessage
}: SettingFieldProps) {
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await onSave(configKey, draft)
    setSaved(true)
    toast.success(successMessage)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className={compact ? 'flex min-w-0 flex-wrap items-center justify-between gap-3' : 'flex flex-col gap-2'}>
      <div className={compact ? 'min-w-0 flex-1' : 'flex items-baseline justify-between'}>
        <label htmlFor={`setting-${configKey}`} className={`${compact ? 'block text-neutral-200' : 'text-neutral-300'} text-sm font-medium`}>{label}</label>
        {compact && description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
        {!compact && description && <span className="text-xs text-neutral-500">{description}</span>}
      </div>
      <div className={compact ? 'relative w-48 max-w-full shrink-0' : 'flex gap-2'}>
        <input
          id={`setting-${configKey}`}
          type={type}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setSaved(false)
          }}
          placeholder={placeholder}
          className={`${compact ? 'settings-default-input h-9.5 w-full min-w-0 bg-[#0f1114] pl-3 pr-20' : 'flex-1 bg-[#0a0a0c] px-3 py-2.5'} rounded-md border border-neutral-800 text-sm text-neutral-200 placeholder-neutral-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 focus:outline-none transition-all`}
        />
        <button
          type="button"
          onClick={handleSave}
          className={compact
            ? 'absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2 text-xs font-medium text-neutral-200 transition-colors hover:border-amber-500/50 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-amber-400'
            : 'rounded-md border border-neutral-700/50 bg-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-700 transition-colors focus:outline-none'}
        >
          {compact && (saved ? <Check size={14} /> : <Save size={14} />)}
          {saved ? savedLabel : saveLabel}
        </button>
      </div>
    </div>
  )
}

function SettingsCard({ title, children, className = '', bodyClassName = '' }: { title: string; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={`app-panel-surface flex min-w-0 flex-col bg-[#141416] border border-neutral-800/80 rounded-xl overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-neutral-800/50">
        <h2 className="text-sm font-medium text-neutral-200">{title}</h2>
      </div>
      <div className={`flex-1 p-6 ${bodyClassName}`}>{children}</div>
    </div>
  )
}

export function SettingsPage(): React.JSX.Element {
  const { config, loading, set } = useConfig()
  const { theme, setTheme, accent, accentForeground, setAccentForeground } = useTheme()
  const [logPath, setLogPath] = useState('')
  const [previewClicks, setPreviewClicks] = useState(0)
  const [appVersion, setAppVersion] = useState('')
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [checkingForUpdates, setCheckingForUpdates] = useState(false)
  const manualUpdateCheck = useRef(false)
  const [cloudAccount, setCloudAccount] = useState<CloudAccount | null>(null)
  const [cloudAccountBusy, setCloudAccountBusy] = useState(false)
  const [lastCloudUpload, setLastCloudUpload] = useState<string | null>(null)
  const [lastCloudDownload, setLastCloudDownload] = useState<string | null>(null)
  const isMacOS = navigator.platform.toLowerCase().includes('mac')
  const { t } = useAppTranslation(['settings', 'common', 'toasts'])

  useEffect(() => {
    if (previewClicks === 10) toast.success('Debug logs enabled.')
  }, [previewClicks])

  useEffect(() => {
    window.api.log.getPath().then(setLogPath)
    void window.api.app.getVersion().then(setAppVersion).catch(() => undefined)
    return window.api.update.onState(state => {
      // Background startup checks must not populate this manual feedback row.
      if (!manualUpdateCheck.current) return
      setUpdateState(state)
      if (state.status !== 'checking' && state.status !== 'downloading') manualUpdateCheck.current = false
    })
  }, [])

  useEffect(() => {
    let active = true
    const refresh = () => { void window.api.cloud.account().then(account => { if (active) setCloudAccount(account) }).catch(() => {}) }
    refresh()
    window.addEventListener('polyhedron:cloud-account-changed', refresh)
    setLastCloudUpload(localStorage.getItem('polyhedron.cloud-sync.last-uploaded'))
    setLastCloudDownload(localStorage.getItem('polyhedron.cloud-sync.last-downloaded'))
    return () => { active = false; window.removeEventListener('polyhedron:cloud-account-changed', refresh) }
  }, [])

  const handleCloudAccount = async () => {
    setCloudAccountBusy(true)
    try {
      const next = cloudAccount?.connected
        ? await window.api.cloud.disconnect()
        : await window.api.cloud.connect()
      setCloudAccount(next)
      window.dispatchEvent(new Event('polyhedron:cloud-account-changed'))
      toast.success(next.connected ? 'Google Drive connected.' : 'Google Drive disconnected.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google Drive authentication failed.')
    } finally {
      setCloudAccountBusy(false)
    }
  }

  const handleCheckForUpdates = async () => {
    manualUpdateCheck.current = true
    setCheckingForUpdates(true)
    setUpdateState({ status: 'checking' })
    try {
      await window.api.update.check()
    } catch (error) {
      manualUpdateCheck.current = false
      setUpdateState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to check for updates.' })
    } finally {
      setCheckingForUpdates(false)
    }
  }

  const handleDownloadUpdate = async () => {
    if (!isMacOS) manualUpdateCheck.current = true
    await window.api.update.download()
  }

  const handleOpenLog = async () => {
    try {
      await window.api.log.open()
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const handleCopyLogPath = async () => {
    try {
      await navigator.clipboard.writeText(logPath)
      toast.success(t('settings.logPathCopied', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const handleClearLog = async () => {
    try {
      await window.api.log.clear()
      toast.success(t('settings.logCleared', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const handleLanguageChange = async (language: string) => {
    if (!isSupportedLanguage(language)) return
    await set('app_language', language)
    await i18n.changeLanguage(language)
  }

  if (loading) {
    return <SettingsLoadingSkeleton />
  }

  return (
    <div className="settings-page-shell p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="app-page-header mb-8 flex items-center gap-3">
          <Settings className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <h1 id="settings-application-heading" className="text-2xl font-semibold text-neutral-100">{t('title')}</h1>
            <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
          </div>
        </div>

        <section className="space-y-6" aria-labelledby="settings-application-heading">
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <SettingsCard title="Application updates" className="order-2" bodyClassName="flex flex-col">
          <div className="flex flex-1 flex-col items-start gap-5">
            <div className="settings-top-card-intro flex items-start gap-3">
              <RefreshCw size={18} className="mt-0.5 shrink-0 text-amber-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-200">Check for updates</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Check GitHub for a newer Polyhedron release.
                </p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-800 bg-[#0f1114] p-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <PolyhedronMark className="h-9 w-9 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-200">Polyhedron</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Installed version: <span className="text-neutral-300">{appVersion || '—'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={checkingForUpdates || updateState?.status === 'downloading'}
                onClick={() => void handleCheckForUpdates()}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-xs font-medium text-neutral-200 transition-colors hover:border-amber-500/50 hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw size={14} className={checkingForUpdates ? 'animate-spin' : ''} /> Check for updates
              </button>
            </div>
            {(updateState?.status === 'available' || updateState?.status === 'downloaded') && <div className="flex flex-wrap gap-2">
              {updateState?.status === 'available' && (
                <button
                  type="button"
                  onClick={() => void handleDownloadUpdate()}
                  className="accent-solid-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white"
                >
                  <Download size={15} /> {isMacOS ? 'Download new version' : 'Download update'}
                </button>
              )}
              {updateState?.status === 'downloaded' && (
                <button
                  type="button"
                  onClick={() => void window.api.update.install()}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
                >
                  <RefreshCw size={15} /> Restart to update
                </button>
              )}
            </div>}
            <div role="status" className="settings-update-feedback mt-auto flex min-h-5 w-full items-center text-[11px] leading-5 tracking-tight">
              {updateState?.status === 'checking' && (
                <AppMessage iconClassName="mt-0 self-center" className="app-message-plain border-0 bg-transparent p-0 text-[11px] leading-5">Checking for updates…</AppMessage>
              )}
              {updateState?.status === 'not-available' && (
                <AppMessage tone="success" iconClassName="mt-0 self-center" className="app-message-plain border-0 bg-transparent p-0 text-[11px] leading-5">You are up to date.</AppMessage>
              )}
              {updateState?.status === 'available' && (
                <AppMessage iconClassName="mt-0 self-center" className="app-message-plain border-0 bg-transparent p-0 text-[11px] leading-5">Version {updateState.version} is available.</AppMessage>
              )}
              {updateState?.status === 'downloading' && (
                <AppMessage iconClassName="mt-0 self-center" className="app-message-plain border-0 bg-transparent p-0 text-[11px] leading-5">Downloading… {Math.round(updateState.percent)}%</AppMessage>
              )}
              {updateState?.status === 'downloaded' && (
                <AppMessage tone="success" iconClassName="mt-0 self-center" className="app-message-plain border-0 bg-transparent p-0 text-[11px] leading-5">Version {updateState.version} is ready to install.</AppMessage>
              )}
              {updateState?.status === 'error' && (
                <AppMessage tone="error" iconClassName="mt-0 self-center" className="app-message-plain border-0 bg-transparent p-0 text-[11px] leading-5">{updateState.message}</AppMessage>
              )}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title="Cloud sync" className="order-1" bodyClassName="flex flex-col">
          <div className="flex flex-1 flex-col gap-5">
            <div className="settings-top-card-intro flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Cloud size={18} className="mt-0.5 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-200">Automatic workspace upload</p>
                  <p className="mt-1 text-xs text-neutral-500">Back up changes to Google Drive.</p>
                </div>
              </div>
              <div className="w-36 shrink-0">
                <ThemedSelect
                  value={config['cloud_auto_sync_interval'] ?? '0'}
                  onChange={(value) => void set('cloud_auto_sync_interval', value)}
                  options={[
                    { value: '0', label: 'Off' },
                    { value: '10', label: 'Every 10 min' },
                    { value: '30', label: 'Every 30 min' },
                    { value: '60', label: 'Every hour' },
                    { value: '120', label: 'Every 2 hours' }
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-800 bg-[#0f1114] p-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {cloudAccount?.photoDataUrl ? (
                  <img src={cloudAccount.photoDataUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-amber-400">
                    {cloudAccount?.connected ? <UserRound size={17} /> : <Cloud size={17} />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-neutral-200">
                    {cloudAccount?.connected ? cloudAccount.displayName || 'Google account' : 'Google Drive'}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                    {cloudAccount?.connected && <Mail size={12} className="shrink-0" />}
                    <span className="break-words">{cloudAccount?.connected ? cloudAccount.emailAddress || 'Account connected' : 'Connect to sync your workspace.'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCloudAccount()}
                disabled={cloudAccountBusy}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-xs font-medium text-neutral-200 transition-colors hover:border-amber-500/50 hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
              >
                {cloudAccountBusy ? <LoaderCircle size={14} className="animate-spin" /> : cloudAccount?.connected ? <LogOut size={14} /> : <LogIn size={14} />}
                {cloudAccountBusy ? 'Connecting…' : cloudAccount?.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>

            <div className="mt-auto flex min-h-5 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] leading-5 tracking-tight">
              <p data-cloud-history="upload" className="flex items-center gap-3 whitespace-nowrap">
                <span className="sr-only">Last upload:</span>
                <AppTooltip label="Last upload"><CircleArrowUp size={18} className="shrink-0 text-amber-300" aria-hidden="true" /></AppTooltip>
                <span className="text-neutral-300">{formatSyncDate(lastCloudUpload)}</span>
              </p>
              <p data-cloud-history="download" className="flex items-center gap-3 whitespace-nowrap">
                <span className="sr-only">Last download:</span>
                <AppTooltip label="Last download"><CircleArrowDown size={18} className="shrink-0 text-amber-300" aria-hidden="true" /></AppTooltip>
                <span className="text-neutral-300">{formatSyncDate(lastCloudDownload)}</span>
              </p>
            </div>
          </div>
        </SettingsCard>
        </div>

        <SettingsCard title="Appearance">
          <div className="mb-4 flex items-center gap-3">
            <Palette size={18} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-200">Theme and accent</p>
              <p className="mt-1 text-xs text-neutral-500">
                Choose an interface theme and customize the accent color used across the app.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {THEMES.map((item) => {
              const selected = theme === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id)}
                  aria-label={`${item.name} theme`}
                  aria-pressed={selected}
                  className={`settings-theme-option relative rounded-lg border p-3 text-left transition-colors ${selected ? 'border-amber-400/70 bg-amber-500/10' : 'border-neutral-800 bg-[#0f1114] hover:border-neutral-600'}`}
                >
                  {selected && (
                    <Check size={14} className="absolute right-3 top-3 text-amber-400" />
                  )}
                  <div className="mb-3 flex gap-1.5">
                    {item.swatches.map((color, index) => (
                      <span
                        key={color}
                        className="h-5 w-5 rounded-full border border-white/10"
                        style={{
                          backgroundColor: index === 0 ? accent : color
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-sm font-medium text-neutral-200">{item.name}</div>
                  <div className="mt-1 truncate text-xs leading-5 text-neutral-500">{item.description}</div>
                </button>
              )
            })}
            <div className="relative cursor-not-allowed rounded-lg border border-neutral-800 bg-[#0f1114] p-3 opacity-55">
              <div className="absolute right-3 top-3 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                Coming Soon
              </div>
              <div className="mb-3 flex gap-1.5">
                <span
                  className="h-5 w-5 rounded-full border border-white/10"
                  style={{ backgroundColor: accent }}
                />
                <span className="h-5 w-5 rounded-full border border-white/10 bg-[#f4f1ed]" />
              </div>
              <div className="text-sm font-medium text-neutral-200">Light</div>
              <div className="mt-1 text-xs leading-5 text-neutral-500">
                A light interface variant is planned for a future update.
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="accent-color" className="text-sm font-medium text-neutral-200">
                Accent color
              </label>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Accent for buttons, borders and highlights.
            </p>
            <AccentColorControl />
            </div>
            <div className="settings-icon-controls grid min-w-0 gap-4">
            <div className="min-w-0">
              <div>
                <p className="text-sm font-medium text-neutral-200">Button text color</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Text on accent buttons.
                </p>
              </div>
              <div className="mt-3 flex min-h-10 flex-wrap items-center gap-3" role="group" aria-label="Button text color">
                {(['white', 'black'] as const).map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color === 'white' ? 'White' : 'Black'}
                    aria-pressed={accentForeground === color}
                    onClick={() => setAccentForeground(color)}
                    style={{ borderRadius: '50%', backgroundColor: color === 'white' ? '#FFFFFF' : '#000000' }}
                    className={`h-8 w-8 shrink-0 cursor-pointer border transition-[transform,border-color] hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400 ${
                      accentForeground === color
                        ? 'border-white ring-2 ring-neutral-200 ring-offset-4 ring-offset-[#101010]'
                        : 'border-neutral-500'
                    }`}
                  />
                ))}
              </div>
            </div>
            <AppIconStyleControl />
            <div className="flex min-h-10 items-center justify-end self-end">
              <button
                type="button"
                className={`${btnPrimary} settings-button-preview !h-8 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400`}
                onClick={() => setPreviewClicks(count => Math.min(count + 1, 10))}
              >
                <FileText />
                PREVIEW
              </button>
            </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title={t('sections.interface')}>
          <div className="mb-5 flex items-start gap-3">
            <Monitor size={18} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-200">Interface preferences</p>
              <p className="mt-1 text-xs text-neutral-500">Customize the language and editor display.</p>
            </div>
          </div>
          <div className="grid items-start gap-x-6 gap-y-5 lg:grid-cols-2 lg:grid-rows-[repeat(4,auto)]">
          <div className="grid min-w-0 gap-5 lg:row-span-4 lg:grid-rows-subgrid">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-200">{t('fields.appLanguage')}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Choose the interface language.
                </p>
              </div>
              <div className="w-40 shrink-0">
                <ThemedSelect
                  value={isSupportedLanguage(config['app_language']) ? config['app_language'] : defaultLanguage}
                  onChange={(value) => { void handleLanguageChange(value) }}
                  options={supportedLanguages.map((language) => ({ value: language, label: languageLabels[language] }))}
                />
              </div>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-200">
                  String count on each page
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  Set the number of strings per page.
                </div>
              </div>
              <div className="w-40 shrink-0">
                <ThemedSelect
                  value={config['translation_page_size'] || '250'}
                  onChange={(value) => {
                    void set('translation_page_size', value)
                  }}
                  options={[100, 250, 500, 1000].map((value) => ({
                    value: String(value),
                    label: `${value} strings`
                  }))}
                />
              </div>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-200">
                  {t('fields.showCounters')}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {t('descriptions.showCounters')}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config['show_translation_counters'] === 'true'}
                onClick={() =>
                  void set(
                    'show_translation_counters',
                    String(config['show_translation_counters'] !== 'true')
                  )
                }
                className={`relative h-5.5 w-9.5 shrink-0 cursor-pointer rounded-full border transition-colors ${config['show_translation_counters'] === 'true' ? 'border-amber-500 bg-amber-500' : 'border-neutral-600 bg-neutral-800'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${config['show_translation_counters'] === 'true' ? 'translate-x-4' : ''}`}
                />
              </button>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-200">Hide developer notes</div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  Hide developer notes from the editor and counts.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config['hide_developer_notes'] !== 'false'}
                onClick={() =>
                  void set(
                    'hide_developer_notes',
                    String(config['hide_developer_notes'] === 'false')
                  )
                }
                className={`relative h-5.5 w-9.5 shrink-0 cursor-pointer rounded-full border transition-colors ${config['hide_developer_notes'] !== 'false' ? 'border-amber-500 bg-amber-500' : 'border-neutral-600 bg-neutral-800'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${config['hide_developer_notes'] !== 'false' ? 'translate-x-4' : ''}`}
                />
              </button>
            </div>
          </div>
          <div className="grid min-w-0 gap-5 lg:row-span-4 lg:grid-rows-subgrid">
            <SettingField
              label={t('fields.defaultAuthor')}
              description="Author used for new translations."
              compact
              configKey="author"
              value={config['author'] ?? ''}
              onSave={set}
              placeholder={t('placeholders.author')}
              saveLabel={t('buttons.save')}
              savedLabel={t('buttons.saved')}
              successMessage={t('settings.saved', {
                ns: 'toasts',
                label: t('fields.defaultAuthor')
              })}
            />
            <SettingField
              label={t('fields.defaultSourceLanguage')}
              description="Default language to translate from."
              compact
              configKey="last_source_lang"
              value={config['last_source_lang'] ?? ''}
              onSave={set}
              placeholder={t('placeholders.sourceLanguage')}
              saveLabel={t('buttons.save')}
              savedLabel={t('buttons.saved')}
              successMessage={t('settings.saved', {
                ns: 'toasts',
                label: t('fields.defaultSourceLanguage')
              })}
            />
            <SettingField
              label={t('fields.defaultTargetLanguage')}
              description="Default language to translate into."
              compact
              configKey="last_target_lang"
              value={config['last_target_lang'] ?? ''}
              onSave={set}
              placeholder={t('placeholders.targetLanguage')}
              saveLabel={t('buttons.save')}
              savedLabel={t('buttons.saved')}
              successMessage={t('settings.saved', {
                ns: 'toasts',
                label: t('fields.defaultTargetLanguage')
              })}
            />
          </div>
          </div>
        </SettingsCard>

        {previewClicks >= 10 && (
        <SettingsSectionCard
          title={t('sections.debugLogs')}
          contentTitle="Diagnostics"
          subtitle="View and manage application logs for troubleshooting."
          icon={<Bug size={18} />}
        >
          <div className="bg-[#0a0a0c] border border-neutral-800/80 rounded-md p-3 font-mono text-xs text-neutral-400 break-all">
            {logPath}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenLog}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
            >
              <FolderOpen size={15} />
              {t('actions.open', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleCopyLogPath}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
            >
              <Copy size={15} />
              {t('actions.copyPath', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleClearLog}
              className="inline-flex items-center gap-2 rounded-md border border-red-900/70 bg-red-950/40 px-4 py-2 text-sm text-red-300 hover:bg-red-950 transition-colors"
            >
              <Trash2 size={15} />
              {t('actions.clear', { ns: 'common' })}
            </button>
          </div>
        </SettingsSectionCard>
        )}
        </section>

        <section className="space-y-6 border-t border-[#1f2329] pt-4" aria-labelledby="settings-ai-heading">
          <div className="app-page-header mb-8 flex items-center gap-3">
            <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <h2 id="settings-ai-heading" className="text-2xl font-semibold text-neutral-100">{t('sections.aiTranslation')}</h2>
              <p className="mt-1 text-sm text-neutral-500">{t('descriptions.aiTranslation')}</p>
            </div>
          </div>
          <AiProvidersCard />
          <MachineProvidersCard />
          <PromptSlotsCard />
          <SimilaritySettingsCard />
          <SettingsSectionCard
            title="Metrics"
            contentTitle="Usage and activity"
            subtitle="View provider usage and recent translation activity."
            icon={<BarChart2 size={18} />}
          >
            <MetricsPage embedded />
          </SettingsSectionCard>
        </section>

      </div>
    </div>
  )
}
