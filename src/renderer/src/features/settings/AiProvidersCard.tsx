import { Check, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { useAISettings } from '@/hooks/useAISettings'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { AiProviderId, ConfigKey } from '@/types'
import { AI_PROVIDERS, type AiProviderMeta, getProviderMeta } from './aiProviders'
import { SettingsSectionCard } from './SettingsSectionCard'

const KEY_SAVE_DEBOUNCE_MS = 600

interface ProviderRowProps {
  meta: AiProviderMeta
  active: boolean
  keyValue: string
  model: string
  onSelect: () => void
  onSaveKey: (key: ConfigKey, value: string) => Promise<void>
  onSaveModel: (value: string) => void
}

// One line per provider: radio (active AI) · badge + name/status · key input · model select.
// There is no save button — the key is persisted automatically while typing (debounced).
function ProviderRow({
  meta,
  active,
  keyValue,
  model,
  onSelect,
  onSaveKey,
  onSaveModel
}: ProviderRowProps): React.JSX.Element {
  const { t } = useAppTranslation(['ai'])
  const [draft, setDraft] = useState(keyValue)
  const [show, setShow] = useState(false)
  const [focused, setFocused] = useState(false)
  const timerRef = useRef<number | null>(null)
  const lastSavedRef = useRef(keyValue)
  const connected = draft.trim().length > 6

  // Config loads asynchronously - adopt the stored key unless the user is typing.
  useEffect(() => {
    if (!focused && timerRef.current === null) {
      setDraft(keyValue)
      lastSavedRef.current = keyValue
    }
  }, [keyValue, focused])

  const persist = (value: string): void => {
    const trimmed = value.trim()
    if (trimmed === lastSavedRef.current) return
    lastSavedRef.current = trimmed
    void onSaveKey(meta.keyConfigKey, trimmed)
  }

  const onKeyInput = (value: string): void => {
    setDraft(value)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => persist(value), KEY_SAVE_DEBOUNCE_MS)
  }

  const flush = (): void => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    persist(draft)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div
      className={`grid grid-cols-[18px_170px_1fr_150px] items-center gap-3 rounded-lg border p-3 transition-colors ${
        active ? 'border-amber-500/60 bg-amber-500/5' : 'border-neutral-800 bg-[#0a0a0c]'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        title={t('providers.useThis')}
        className={`flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-full border transition-colors ${
          active ? 'border-amber-500' : 'border-neutral-600 hover:border-neutral-400'
        }`}
      >
        {active && <span className="h-2 w-2 rounded-full bg-amber-500" />}
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold text-white"
          style={{ background: meta.color }}
        >
          {meta.mark}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-neutral-200">{meta.name}</div>
          <div
            className={`flex items-center gap-1 text-[10px] ${connected ? 'text-amber-400' : 'text-neutral-500'}`}
          >
            {connected && <Check size={10} />}
            {connected ? t('providers.connected') : t('providers.noKey')}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1 rounded-md border border-neutral-800 bg-[#0a0a0c] px-3 transition-colors focus-within:border-amber-500">
        <input
          type={show ? 'text' : 'password'}
          value={draft}
          placeholder={`${meta.name} API key`}
          onChange={(e) => onKeyInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            flush()
          }}
          className="min-w-0 flex-1 bg-transparent py-2 font-mono text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="cursor-pointer text-neutral-500 transition-colors hover:text-neutral-300"
          title={show ? t('providers.hideKey') : t('providers.showKey')}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <ThemedSelect
        value={model}
        onChange={onSaveModel}
        options={meta.models.map((m) => ({ value: m, label: m }))}
      />
    </div>
  )
}

export function AiProvidersCard(): React.JSX.Element {
  const { t } = useAppTranslation(['ai'])
  const { set, provider, modelFor, keyFor } = useAISettings()

  const selectProvider = (id: AiProviderId): void => {
    void set('ai_provider', id)
  }

  return (
    <SettingsSectionCard
      title={t('providers.title')}
      subtitle={t('providers.subtitle')}
      icon={<Sparkles size={16} />}
    >
      <div className="flex flex-col gap-2">
        {AI_PROVIDERS.map((meta) => (
          <ProviderRow
            key={meta.id}
            meta={meta}
            active={provider === meta.id}
            keyValue={keyFor(meta.id)}
            model={modelFor(meta.id)}
            onSelect={() => selectProvider(meta.id)}
            onSaveKey={set}
            onSaveModel={(value) => void set(meta.modelConfigKey, value)}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <Check size={12} className="text-amber-500" />
          {t('providers.activeHint', {
            provider: getProviderMeta(provider).name,
            model: modelFor(provider)
          })}
        </span>
        <span>{t('providers.autoSaved')}</span>
      </div>
    </SettingsSectionCard>
  )
}
