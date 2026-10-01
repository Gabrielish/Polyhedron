import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import { normalizeSearchText } from '@/utils/search'

export interface ThemedSelectOption {
  value: string
  label: string
  badge?: string
  searchText?: string
}

interface MenuPosition {
  top: number
  left: number
  width: number
}

interface ThemedSelectProps {
  value: string
  onChange: (value: string) => void
  options: ThemedSelectOption[]
  placeholder?: string
  emptyLabel?: string
  searchable?: boolean
  searchPlaceholder?: string
  label?: string
  className?: string
  accent?: boolean
  triggerClassName?: string
  menuClassName?: string
  menuMinWidth?: number
  triggerAdornment?: React.ReactNode
  maxOptionsWithoutQuery?: number
  virtualized?: boolean
}

const MENU_GAP = 4
const MENU_MAX_HEIGHT = 240

export function ThemedSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  searchable = false,
  searchPlaceholder,
  label,
  className,
  accent = false,
  triggerClassName,
  menuClassName,
  menuMinWidth,
  triggerAdornment,
  maxOptionsWithoutQuery,
  virtualized = false
}: ThemedSelectProps): React.JSX.Element {
  const { t } = useAppTranslation('common')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [optionScrollTop, setOptionScrollTop] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const resolvedPlaceholder = placeholder ?? t('placeholders.select')
  const resolvedEmptyLabel = emptyLabel ?? t('placeholders.noOptionFound')
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('placeholders.search')

  useEffect(() => {
    setOptionScrollTop(0)
  }, [query])

  const selected = options.find((option) => option.value === value)
  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const normalized = normalizeSearchText(query)
    return options.filter((option) => {
      const haystack = `${option.label} ${option.badge ?? ''} ${option.searchText ?? ''}`
      return normalizeSearchText(haystack).includes(normalized)
    })
  }, [options, query, searchable])
  const visibleOptions = useMemo(() => {
    if (virtualized || !maxOptionsWithoutQuery || query.trim() || filteredOptions.length <= maxOptionsWithoutQuery) {
      return filteredOptions
    }
    return filteredOptions.slice(0, maxOptionsWithoutQuery)
  }, [filteredOptions, maxOptionsWithoutQuery, query, virtualized])
  const virtualStart = virtualized ? Math.max(0, Math.floor(optionScrollTop / 32) - 5) : 0
  const virtualEnd = virtualized
    ? Math.min(visibleOptions.length, Math.ceil((optionScrollTop + 240) / 32) + 5)
    : visibleOptions.length
  const renderedOptions = visibleOptions.slice(virtualStart, virtualEnd)

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return

      const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP
      const spaceAbove = rect.top - MENU_GAP
      const shouldOpenAbove = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow
      const height = Math.min(MENU_MAX_HEIGHT, shouldOpenAbove ? spaceAbove : spaceBelow)

      setMenuPosition({
        top: shouldOpenAbove
          ? Math.max(MENU_GAP, rect.top - MENU_GAP - Math.max(180, height))
          : rect.bottom + MENU_GAP,
        left: rect.left,
        width: Math.max(rect.width, menuMinWidth ?? rect.width)
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [menuMinWidth, open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
      setOptionScrollTop(0)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setQuery('')
        setOptionScrollTop(0)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open || !searchable) return
    const handle = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(handle)
  }, [open, searchable])

  const closeMenu = () => {
    setOpen(false)
    setQuery('')
    setOptionScrollTop(0)
  }

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            id={listboxId}
            className={cn(
              'fixed z-[80] overflow-hidden rounded-lg border border-neutral-600 bg-[#131518] shadow-2xl',
              menuClassName
            )}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width
            }}
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b border-[#1f2329] px-3 py-2.5 text-neutral-500">
                <Search size={14} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={resolvedSearchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="shrink-0 cursor-pointer text-neutral-500 transition-colors hover:text-neutral-200"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}

            <div
              className="themed-select-options max-h-60 overflow-x-hidden overflow-y-auto py-1 pl-1 pr-1"
              onScroll={(event) => setOptionScrollTop(event.currentTarget.scrollTop)}
              style={virtualized ? { height: 240 } : undefined}
            >
              {visibleOptions.length > 0 ? (
                <div
                  style={
                    virtualized
                      ? { height: visibleOptions.length * 32, position: 'relative' }
                      : undefined
                  }
                >
                {renderedOptions.map((option, offset) => {
                  const optionIndex = virtualStart + offset
                  const active = option.value === value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value)
                        closeMenu()
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                        active
                          ? 'bg-amber-400/10 text-amber-400'
                          : 'text-neutral-300 hover:bg-neutral-800'
                      )}
                      style={
                        virtualized
                          ? { position: 'absolute', top: optionIndex * 32, left: 0, right: 0, height: 32 }
                          : undefined
                      }
                    >
                      <span className="flex-1 truncate">{option.label}</span>
                      {option.badge && (
                        <span className="font-mono text-[10px] text-neutral-500">
                          {option.badge}
                        </span>
                      )}
                      {active && <Check size={12} />}
                    </button>
                  )
                })}
                </div>
              ) : (
                <div className="px-2.5 py-3 text-xs text-neutral-500">{resolvedEmptyLabel}</div>
              )}
              {maxOptionsWithoutQuery && !query.trim() && filteredOptions.length > visibleOptions.length && (
                <div className="px-2.5 py-2 text-[10px] text-neutral-500">
                  Type to search {filteredOptions.length - visibleOptions.length} more options
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className={cn('flex flex-col gap-1', className)}>
      {label && <label className="text-xs text-neutral-400">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          setOptionScrollTop(0)
          setOpen((current) => !current)
        }}
        className={cn(
          'flex h-9.5 w-full cursor-pointer items-center gap-2.5 rounded-md border px-3 text-left text-sm transition-[border-color,background-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50',
          open
            ? 'border-amber-500 bg-[#0f1114] shadow-[0_0_0_3px_rgba(245,158,11,0.15)]'
            : 'border-[#1f2329] bg-[#0f1114] hover:border-neutral-600',
          accent ? 'text-amber-400' : 'text-neutral-200',
          triggerClassName
        )}
      >
        <span className="flex-1 truncate font-medium">
          {selected?.label ?? resolvedPlaceholder}
        </span>
        {selected?.badge && (
          <span
            className={cn(
              'shrink-0 rounded border border-[#1f2329] bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px]',
              accent ? 'text-amber-400' : 'text-neutral-500'
            )}
          >
            {selected.badge}
          </span>
        )}
        {triggerAdornment}
        <span className={cn('shrink-0', accent ? 'text-amber-500' : 'text-neutral-500')}>
          <ChevronDown size={16} />
        </span>
      </button>
      {menu}
    </div>
  )
}
