import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeId = 'liquid-glass' | 'light'

export const THEMES: Array<{ id: ThemeId; name: string; description: string; swatches: string[] }> = [
  { id: 'liquid-glass', name: 'Dark', description: 'A dark translucent interface with soft blur, glass surfaces and a customizable accent color.', swatches: ['#ed1c24', '#0a0d12'] },
  { id: 'light', name: 'Light', description: 'A bright, clean interface with warm Dungeons & Dragons-inspired red accents.', swatches: ['#c62828', '#f4f1ed'] }
]

interface ThemeContextValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  accent: string
  setAccent: (accent: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'icosa-theme'
const ACCENT_STORAGE_KEY = 'icosa-accent'
export const DEFAULT_ACCENT = '#ED1C24'

function normalizeAccent(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toUpperCase() : DEFAULT_ACCENT
}

function mixHex(hex: string, target: string, amount: number): string {
  const source = hex.slice(1)
  const targetValue = target.slice(1)
  const channels = [0, 2, 4].map((offset) => {
    const value = Math.round(parseInt(source.slice(offset, offset + 2), 16) * (1 - amount) + parseInt(targetValue.slice(offset, offset + 2), 16) * amount)
    return value.toString(16).padStart(2, '0')
  })
  return `#${channels.join('')}`
}

function hexToRgb(hex: string): string {
  const value = hex.slice(1)
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(' ')
}

function readTheme(): ThemeId {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' ? 'light' : 'liquid-glass'
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(readTheme)
  const [accent, setAccentState] = useState(() => normalizeAccent(window.localStorage.getItem(ACCENT_STORAGE_KEY) || DEFAULT_ACCENT))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
    document.documentElement.style.setProperty('--poly-accent', accent)
    document.documentElement.style.setProperty('--poly-accent-rgb', hexToRgb(accent))
    document.documentElement.style.setProperty('--color-amber-300', mixHex(accent, '#ffffff', 0.55))
    document.documentElement.style.setProperty('--color-amber-400', mixHex(accent, '#ffffff', 0.30))
    document.documentElement.style.setProperty('--color-amber-500', accent)
    document.documentElement.style.setProperty('--color-amber-600', mixHex(accent, '#000000', 0.18))
    document.documentElement.style.setProperty('--color-amber-700', mixHex(accent, '#000000', 0.38))
    document.documentElement.style.setProperty('--color-amber-800', mixHex(accent, '#000000', 0.55))
    document.documentElement.style.setProperty('--color-amber-900', mixHex(accent, '#000000', 0.68))
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent)
  }, [accent, theme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: (nextTheme) => setThemeState(nextTheme),
    accent,
    setAccent: (nextAccent) => setAccentState(normalizeAccent(nextAccent))
  }), [accent, theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
