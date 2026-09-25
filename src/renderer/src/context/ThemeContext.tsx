import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeId = 'liquid-glass'

export const THEMES: Array<{ id: ThemeId; name: string; description: string; swatches: string[] }> =
  [
    {
      id: 'liquid-glass',
      name: 'Liquid Glass (Dark)',
      description:
        'A dark translucent interface with soft blur, glass surfaces and a customizable accent color.',
      swatches: ['#ed1c24', '#0a0d12']
    }
  ]

interface ThemeContextValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  accent: string
  setAccent: (accent: string) => void
  accentForeground: 'white' | 'black'
  setAccentForeground: (foreground: 'white' | 'black') => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'polyhedron-theme'
const ACCENT_STORAGE_KEY = 'polyhedron-accent'
const ACCENT_FOREGROUND_STORAGE_KEY = 'polyhedron-accent-foreground'
const LEGACY_ACCENT_STORAGE_KEY = 'icosa-accent'
const LEGACY_ACCENT_FOREGROUND_STORAGE_KEY = 'icosa-accent-foreground'
export const DEFAULT_ACCENT = '#ED1C24'

function normalizeAccent(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toUpperCase() : DEFAULT_ACCENT
}

function mixHex(hex: string, target: string, amount: number): string {
  const source = hex.slice(1)
  const targetValue = target.slice(1)
  const channels = [0, 2, 4].map((offset) => {
    const value = Math.round(
      parseInt(source.slice(offset, offset + 2), 16) * (1 - amount) +
        parseInt(targetValue.slice(offset, offset + 2), 16) * amount
    )
    return value.toString(16).padStart(2, '0')
  })
  return `#${channels.join('')}`
}

function hexToRgb(hex: string): string {
  const value = hex.slice(1)
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(' ')
}

function readTheme(): ThemeId {
  return 'liquid-glass'
}

function readStorageValue(key: string, legacyKey: string): string | null {
  return window.localStorage.getItem(key) ?? window.localStorage.getItem(legacyKey)
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(readTheme)
  const [accent, setAccentState] = useState(() =>
    normalizeAccent(
      readStorageValue(ACCENT_STORAGE_KEY, LEGACY_ACCENT_STORAGE_KEY) || DEFAULT_ACCENT
    )
  )
  const [accentForeground, setAccentForegroundState] = useState<'white' | 'black'>(() =>
    readStorageValue(ACCENT_FOREGROUND_STORAGE_KEY, LEGACY_ACCENT_FOREGROUND_STORAGE_KEY) ===
    'black'
      ? 'black'
      : 'white'
  )
  // localStorage keeps the renderer fast, while the config table is the durable
  // profile store used by packaged builds and workspace backups. Read it once
  // on startup so a rebuilt app cannot silently fall back to the default red.
  useEffect(() => {
    void window.api.config
      .getAll()
      .then((config) => {
        if (config.theme_id === 'liquid-glass') setThemeState('liquid-glass')
        if (config.theme_accent) setAccentState(normalizeAccent(config.theme_accent))
        if (
          config.theme_accent_foreground === 'black' ||
          config.theme_accent_foreground === 'white'
        ) {
          setAccentForegroundState(config.theme_accent_foreground)
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
    document.documentElement.style.setProperty('--poly-accent', accent)
    document.documentElement.style.setProperty(
      '--poly-accent-foreground',
      accentForeground === 'black' ? '#101010' : '#ffffff'
    )
    document.documentElement.style.setProperty('--poly-accent-rgb', hexToRgb(accent))
    document.documentElement.style.setProperty('--color-amber-300', mixHex(accent, '#ffffff', 0.55))
    document.documentElement.style.setProperty('--color-amber-400', mixHex(accent, '#ffffff', 0.3))
    document.documentElement.style.setProperty('--color-amber-500', accent)
    document.documentElement.style.setProperty('--color-amber-600', mixHex(accent, '#000000', 0.18))
    document.documentElement.style.setProperty('--color-amber-700', mixHex(accent, '#000000', 0.38))
    document.documentElement.style.setProperty('--color-amber-800', mixHex(accent, '#000000', 0.55))
    document.documentElement.style.setProperty('--color-amber-900', mixHex(accent, '#000000', 0.68))
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent)
    window.localStorage.setItem(ACCENT_FOREGROUND_STORAGE_KEY, accentForeground)
  }, [accent, accentForeground, theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme)
        void window.api.config.set({ key: 'theme_id', value: nextTheme })
      },
      accent,
      setAccent: (nextAccent) => {
        const normalized = normalizeAccent(nextAccent)
        setAccentState(normalized)
        void window.api.config.set({ key: 'theme_accent', value: normalized })
      },
      accentForeground,
      setAccentForeground: (nextForeground) => {
        setAccentForegroundState(nextForeground)
        void window.api.config.set({ key: 'theme_accent_foreground', value: nextForeground })
      }
    }),
    [accent, accentForeground, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
