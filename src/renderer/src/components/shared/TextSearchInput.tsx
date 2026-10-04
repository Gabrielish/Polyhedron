import { CaseSensitive, Search, WholeWord, X } from 'lucide-react'
import { ThemedSelect, type ThemedSelectOption } from '@/components/shared/ThemedSelect'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

interface TextSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  matchCase: boolean
  onMatchCaseChange: (value: boolean) => void
  matchWholeWord: boolean
  onMatchWholeWordChange: (value: boolean) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
  className?: string
  scopeValue?: string
  onScopeChange?: (value: string) => void
  scopeOptions?: ThemedSelectOption[]
}

function ToggleButton({
  active,
  label,
  onClick,
  children
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'translation-toolbar-toggle group/search-toggle relative z-30 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded transition-colors hover:z-50 hover:!bg-transparent hover:!text-amber-400 focus:z-50 focus:outline-none',
        active
          ? 'text-amber-400'
          : 'text-neutral-600 hover:bg-transparent hover:text-amber-400'
      )}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[100] w-max max-w-52 -translate-x-1/2 translate-y-[-2px] whitespace-nowrap rounded-md border border-neutral-700 bg-[#131518] px-2 py-1.5 text-[10px] font-medium leading-tight text-neutral-200 opacity-0 shadow-2xl transition-all duration-150 group-hover/search-toggle:translate-y-0 group-hover/search-toggle:opacity-100 group-focus-visible/search-toggle:translate-y-0 group-focus-visible/search-toggle:opacity-100"
      >
        {label}
      </span>
    </button>
  )
}

export function TextSearchInput({
  value,
  onChange,
  placeholder,
  matchCase,
  onMatchCaseChange,
  matchWholeWord,
  onMatchWholeWordChange,
  inputRef,
  className,
  scopeValue,
  onScopeChange,
  scopeOptions
}: TextSearchInputProps): React.JSX.Element {
  const { t } = useAppTranslation('common')

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const key = event.key.toLowerCase()
    if (key === 'c') {
      event.preventDefault()
      onMatchCaseChange(!matchCase)
    } else if (key === 'w') {
      event.preventDefault()
      onMatchWholeWordChange(!matchWholeWord)
    }
  }

  return (
    <div
      className={cn(
        'text-search-input-shell relative z-20 flex h-8 items-center gap-2 overflow-visible rounded-md border border-[#1f2329] bg-[#131518] px-3 transition-colors focus-within:border-neutral-600',
        className
      )}
    >
      <Search size={13} className="shrink-0 text-neutral-500" />
      {scopeValue !== undefined && onScopeChange && scopeOptions && (
        <ThemedSelect
          value={scopeValue}
          onChange={onScopeChange}
          options={scopeOptions}
          className="w-[7.5rem] shrink-0"
          triggerClassName="h-6 border-0 bg-transparent px-1.5 text-[11px] shadow-none hover:border-transparent hover:bg-[#1c1f24]"
          menuMinWidth={148}
        />
      )}
      {scopeValue !== undefined && onScopeChange && scopeOptions && (
        <span className="h-4 w-px shrink-0 bg-[#1f2329]" />
      )}
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="translation-search-input min-w-0 flex-1 border-0 bg-transparent text-xs font-medium text-neutral-300 placeholder:text-neutral-600 outline-none focus:border-0 focus:outline-none focus:ring-0"
      />
      {value && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange('')}
          aria-label={t('actions.clear')}
          className="shrink-0 cursor-pointer text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <X size={13} />
        </button>
      )}
      <div className="flex shrink-0 items-center gap-0.5 border-l border-[#1f2329] pl-1.5">
        <ToggleButton
          active={matchCase}
          label="Match case"
          onClick={() => onMatchCaseChange(!matchCase)}
        >
          <CaseSensitive size={14} />
        </ToggleButton>
        <ToggleButton
          active={matchWholeWord}
          label="Whole word"
          onClick={() => onMatchWholeWordChange(!matchWholeWord)}
        >
          <WholeWord size={13} />
        </ToggleButton>
      </div>
    </div>
  )
}
