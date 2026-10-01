import {
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  FolderOpen,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  Palette,
  RefreshCw,
  Settings,
  Trash2,
  UserRound
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { AiProvidersCard } from '@/features/settings/AiProvidersCard'
import { PromptSlotsCard } from '@/features/settings/PromptSlotsCard'
import { SimilaritySettingsCard } from '@/features/settings/SimilaritySettingsCard'
import { MetricsPage } from './MetricsPage'
import { DEFAULT_ACCENT, RED_ACCENT, THEMES, useTheme } from '@/context/ThemeContext'
import { useConfig } from '@/hooks/useConfig'
import { i18n } from '@/i18n'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { defaultLanguage, languageLabels, supportedLanguages } from '@/i18n/languages'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ConfigKey } from '@/types'
import type { UpdateState } from '../../../preload/api-types'

interface SettingFieldProps {
  label: string
  description?: string
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

function formatCloudDate(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function SettingField({
  label,
  description,
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
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-neutral-300">{label}</label>
        {description && <span className="text-xs text-neutral-500">{description}</span>}
      </div>
      <div className="flex gap-2">
        <input
          type={type}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setSaved(false)
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-neutral-800 bg-[#0a0a0c] px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 focus:outline-none transition-all"
        />
        <button
          onClick={handleSave}
          className="rounded-md border border-neutral-700/50 bg-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-700 transition-colors focus:outline-none"
        >
          {saved ? savedLabel : saveLabel}
        </button>
      </div>
    </div>
  )
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141416] border border-neutral-800/80 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800/50">
        <h2 className="text-sm font-medium text-neutral-200">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export function SettingsPage(): React.JSX.Element {
  const { config, loading, set } = useConfig()
  const { theme, setTheme, accent, setAccent, accentForeground, setAccentForeground } = useTheme()
  const [accentDraft, setAccentDraft] = useState(accent)
  const [logPath, setLogPath] = useState('')
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [checkingForUpdates, setCheckingForUpdates] = useState(false)
  const [cloudAccount, setCloudAccount] = useState<CloudAccount | null>(null)
  const [cloudAccountBusy, setCloudAccountBusy] = useState(false)
  const [lastCloudUpload, setLastCloudUpload] = useState<string | null>(null)
  const [lastCloudDownload, setLastCloudDownload] = useState<string | null>(null)
  const isMacOS = navigator.platform.toLowerCase().includes('mac')
  const { t } = useAppTranslation(['settings', 'common', 'toasts'])

  useEffect(() => {
    window.api.log.getPath().then(setLogPath)
    return window.api.update.onState(setUpdateState)
  }, [])

  useEffect(() => {
    void window.api.cloud.account().then(setCloudAccount)
    setLastCloudUpload(localStorage.getItem('polyhedron.cloud-sync.last-uploaded'))
    setLastCloudDownload(localStorage.getItem('polyhedron.cloud-sync.last-downloaded'))
  }, [])

  const handleCloudAccount = async () => {
    setCloudAccountBusy(true)
    try {
      const next = cloudAccount?.connected
        ? await window.api.cloud.disconnect()
        : await window.api.cloud.connect()
      setCloudAccount(next)
      toast.success(next.connected ? 'Google Drive connected.' : 'Google Drive disconnected.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google Drive authentication failed.')
    } finally {
      setCloudAccountBusy(false)
    }
  }

  const handleCheckForUpdates = async () => {
    setCheckingForUpdates(true)
    setUpdateState({ status: 'checking' })
    try {
      await window.api.update.check()
    } finally {
      setCheckingForUpdates(false)
    }
  }

  const handleDownloadUpdate = async () => {
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
    await set('app_language', language)
    await i18n.changeLanguage(language)
  }

  if (loading) {
    return <SettingsLoadingSkeleton />
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="app-page-header mb-8 flex items-center gap-3">
          <Settings className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-neutral-100">{t('title')}</h1>
            <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
          </div>
        </div>

        <SettingsCard title="Application updates">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <RefreshCw size={18} className="mt-0.5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-neutral-200">Check for updates</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Manually check GitHub for a newer Polyhedron release.
                  {isMacOS ? ' macOS downloads are opened manually.' : ''}
                </p>
                {updateState?.status === 'checking' && (
                  <p className="mt-2 text-xs text-neutral-400">Checking for updates…</p>
                )}
                {updateState?.status === 'not-available' && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 size={13} /> You are up to date.
                  </p>
                )}
                {updateState?.status === 'available' && (
                  <p className="mt-2 text-xs text-amber-300">
                    Version {updateState.version} is available.
                  </p>
                )}
                {updateState?.status === 'downloading' && (
                  <p className="mt-2 text-xs text-neutral-400">
                    Downloading… {Math.round(updateState.percent)}%
                  </p>
                )}
                {updateState?.status === 'downloaded' && (
                  <p className="mt-2 text-xs text-emerald-400">
                    Version {updateState.version} is ready to install.
                  </p>
                )}
                {updateState?.status === 'error' && (
                  <p className="mt-2 max-w-xl text-xs text-red-300">{updateState.message}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <button
                type="button"
                disabled={checkingForUpdates || updateState?.status === 'downloading'}
                onClick={() => void handleCheckForUpdates()}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw size={15} className={checkingForUpdates ? 'animate-spin' : ''} /> Check
                for updates
              </button>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title="Cloud sync">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-800 bg-[#0f1013] p-4">
              <div className="flex min-w-0 items-center gap-3">
                {cloudAccount?.photoDataUrl ? (
                  <img src={cloudAccount.photoDataUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-amber-400">
                    {cloudAccount?.connected ? <UserRound size={17} /> : <Cloud size={17} />}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-200">
                    {cloudAccount?.connected ? cloudAccount.displayName || 'Google account' : 'Google Drive not connected'}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-neutral-500">
                    {cloudAccount?.connected && <Mail size={12} />}
                    {cloudAccount?.connected ? cloudAccount.emailAddress || 'Account connected' : 'Connect an account to enable cloud sync'}
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
                {cloudAccountBusy ? 'Connecting…' : cloudAccount?.connected ? 'Disconnect' : 'Connect Google Drive'}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-neutral-800 bg-[#0f1013] px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Last upload</div>
                <div className="mt-1 text-xs text-neutral-300">{formatCloudDate(lastCloudUpload)}</div>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-[#0f1013] px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Last download</div>
                <div className="mt-1 text-xs text-neutral-300">{formatCloudDate(lastCloudDownload)}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-800/70 pt-4">
              <div className="flex items-start gap-3">
                <Cloud size={18} className="mt-0.5 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-200">Automatic workspace upload</p>
                  <p className="mt-1 max-w-xl text-xs text-neutral-500">
                    Upload local changes to Google Drive in the background. Automatic uploads never
                    open the upload dialog. If Drive has changed, syncing pauses until you review it.
                  </p>
                </div>
              </div>
              <div className="w-44 shrink-0">
                <ThemedSelect
                  value={config['cloud_auto_sync_interval'] ?? '0'}
                  onChange={(value) => void set('cloud_auto_sync_interval', value)}
                  options={[
                    { value: '0', label: 'Off' },
                    { value: '10', label: 'Every 10 minutes' },
                    { value: '30', label: 'Every 30 minutes' },
                    { value: '60', label: 'Every hour' },
                    { value: '120', label: 'Every 2 hours' }
                  ]}
                />
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title="Appearance">
          <div className="mb-4 flex items-center gap-2 text-sm text-neutral-400">
            <Palette size={16} className="text-amber-400" />
            <span>
              Choose an interface theme and customize the accent color used across the app.
            </span>
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
                  className={`relative rounded-lg border p-3 text-left transition-colors ${selected ? 'border-amber-400/70 bg-amber-500/10' : 'border-neutral-800 bg-[#0f1114] hover:border-neutral-600'}`}
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
                  <div className="mt-1 text-xs leading-5 text-neutral-500">{item.description}</div>
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
              <div className="text-sm font-medium text-neutral-200">Liquid Glass (Light)</div>
              <div className="mt-1 text-xs leading-5 text-neutral-500">
                A light variant of Liquid Glass is planned for a future update.
              </div>
            </div>
          </div>
          <div className="mt-5 border-t border-neutral-800/60 pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="accent-color" className="text-sm font-medium text-neutral-200">
                Accent color
              </label>
              <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">HEX</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Choose the accent used for buttons, active states, borders and glow effects.
            </p>
            <div className="mt-3 flex max-w-sm flex-wrap gap-2">
              <input
                id="accent-color"
                type="text"
                value={accentDraft}
                maxLength={7}
                placeholder="#8C52FF"
                onChange={(event) => {
                  const value = event.target.value.toUpperCase()
                  setAccentDraft(value)
                  if (/^#[0-9A-F]{6}$/.test(value)) setAccent(value)
                }}
                className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-[#0a0a0c] px-3 py-2.5 font-mono text-sm text-neutral-200 placeholder-neutral-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 focus:outline-none"
              />
              <input
                aria-label="Pick accent color"
                type="color"
                value={/^#[0-9A-F]{6}$/.test(accentDraft) ? accentDraft : accent}
                onChange={(event) => {
                  const value = event.target.value.toUpperCase()
                  setAccentDraft(value)
                  setAccent(value)
                }}
                className="h-10 w-12 cursor-pointer rounded-md border border-neutral-800 bg-[#0a0a0c] p-1"
              />
              <button
                type="button"
                onClick={() => {
                  setAccentDraft(DEFAULT_ACCENT)
                  setAccent(DEFAULT_ACCENT)
                }}
                className="rounded-md border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-900"
              >
                Reset default
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccentDraft(RED_ACCENT)
                  setAccent(RED_ACCENT)
                }}
                className="rounded-md border border-red-500/30 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-500/10"
              >
                Use red
              </button>
            </div>
            {accentDraft && !/^#[0-9A-F]{6}$/.test(accentDraft) && (
              <p className="mt-2 text-xs text-red-300">
                Enter a six-digit HEX value, for example #ED1C24.
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-200">Button text color</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Choose the text color used on solid accent buttons. This is always manual.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="text-xs text-neutral-500">
                  {accentForeground === 'white' ? 'White' : 'Black'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={accentForeground === 'black'}
                  aria-label="Use black text on accent buttons"
                  onClick={() =>
                    setAccentForeground(accentForeground === 'white' ? 'black' : 'white')
                  }
                  className={`relative h-5.5 w-9.5 shrink-0 rounded-full border transition-colors ${accentForeground === 'black' ? 'border-amber-500 bg-amber-500' : 'border-neutral-600 bg-neutral-800'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${accentForeground === 'black' ? 'translate-x-4' : ''}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title={t('sections.interface')}>
          <div className="divide-y divide-neutral-800/70">
            <div className="flex items-center justify-between gap-5 py-3 first:pt-0">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-200">
                  String count on each page
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  Choose how many translation and database entries are shown at once.
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
            <div className="flex items-center justify-between gap-5 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-200">Show Database tab</div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  Show the Database tab in the navigation bar.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config['show_glossary'] === 'true'}
                onClick={() =>
                  void set('show_glossary', String(config['show_glossary'] !== 'true'))
                }
                className={`relative h-5.5 w-9.5 shrink-0 cursor-pointer rounded-full border transition-colors ${config['show_glossary'] === 'true' ? 'border-amber-500 bg-amber-500' : 'border-neutral-600 bg-neutral-800'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${config['show_glossary'] === 'true' ? 'translate-x-4' : ''}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between gap-5 py-3">
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
            <div className="flex items-center justify-between gap-5 py-3 last:pb-0">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-200">Hide developer notes</div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  Hide internal strings beginning with %%% or wrapped in | ... | from the editor and
                  progress counters.
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
        </SettingsCard>
        <AiProvidersCard />
        <PromptSlotsCard />
        <SimilaritySettingsCard />
        <SettingsCard title="Metrics">
          <MetricsPage embedded />
        </SettingsCard>

        <SettingsCard title={t('sections.apiKeys')}>
          {/* OpenAI key hidden until supported
          <SettingField
            label="OpenAI API Key"
            configKey="openai_key"
            value={config['openai_key'] ?? ''}
            onSave={set}
            type="password"
            placeholder="sk-..."
          /> */}
          <SettingField
            label={t('fields.deeplKey')}
            configKey="deepl_key"
            value={config['deepl_key'] ?? ''}
            onSave={set}
            type="password"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
            saveLabel={t('buttons.save')}
            savedLabel={t('buttons.saved')}
            successMessage={t('settings.saved', {
              ns: 'toasts',
              label: t('fields.deeplKey')
            })}
          />
          <SettingField
            label={t('fields.googleKey')}
            configKey="google_key"
            value={config['google_key'] ?? ''}
            onSave={set}
            type="password"
            placeholder="AIza..."
            saveLabel={t('buttons.save')}
            savedLabel={t('buttons.saved')}
            successMessage={t('settings.saved', {
              ns: 'toasts',
              label: t('fields.googleKey')
            })}
          />
        </SettingsCard>

        <SettingsCard title={t('sections.language')}>
          <div className="flex max-w-sm flex-col gap-2">
            <label className="text-sm font-medium text-neutral-300">
              {t('fields.appLanguage')}
            </label>
            <ThemedSelect
              value={config['app_language'] || defaultLanguage}
              onChange={(value) => {
                void handleLanguageChange(value)
              }}
              options={supportedLanguages.map((language) => ({
                value: language,
                label: languageLabels[language]
              }))}
            />
          </div>
        </SettingsCard>

        <SettingsCard title={t('sections.defaults')}>
          <div className="space-y-5">
            <SettingField
              label={t('fields.defaultAuthor')}
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
        </SettingsCard>

        <SettingsCard title={t('sections.tools')}>
          <SettingField
            label={t('fields.divinePath')}
            description={t('descriptions.divinePath')}
            configKey="divine_path"
            value={config['divine_path'] ?? ''}
            onSave={set}
            placeholder={t('placeholders.divinePath')}
            saveLabel={t('buttons.save')}
            savedLabel={t('buttons.saved')}
            successMessage={t('settings.saved', {
              ns: 'toasts',
              label: t('fields.divinePath')
            })}
          />
        </SettingsCard>

        <SettingsCard title={t('sections.debugLogs')}>
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
        </SettingsCard>

        <div className="h-4" />
      </div>
    </div>
  )
}

function SettingsLoadingSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full justify-center animate-pulse bg-[#0c0d0f] p-8">
      <div className="w-full max-w-4xl space-y-6">
        <div className="mb-8 flex items-center gap-3"><div className="h-6 w-6 rounded bg-[#6d45d8]/50" /><div className="space-y-2"><div className="h-7 w-28 rounded bg-[#20242a]" /><div className="h-3 w-80 rounded bg-[#181c21]" /></div></div>
        {['w-36', 'w-24', 'w-20'].map((title, index) => <div key={index} className="overflow-hidden rounded-xl border border-[#1f2329] bg-[#131518]"><div className="border-b border-[#1f2329] px-6 py-5"><div className={`h-4 ${title} rounded bg-[#20242a]`} /></div><div className="space-y-5 p-6"><div className="h-4 w-3/5 rounded bg-[#181c21]" /><div className="h-20 rounded-xl bg-[#181c21]" /><div className="h-10 w-48 rounded-lg bg-[#181c21]" /></div></div>)}
      </div>
    </div>
  )
}
