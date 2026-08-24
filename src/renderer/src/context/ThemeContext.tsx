import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeId = 'classic' | 'larian' | 'arcane' | 'emerald' | 'bloodmoon' | 'ocean' | 'icosa-green' | 'duolingo-dark' | 'obsidian'

export const THEMES: Array<{ id: ThemeId; name: string; description: string; swatches: string[] }> = [
  { id: 'classic', name: 'Classic ICOSA', description: 'The original dark interface with a warm orange accent.', swatches: ['#f59e0b', '#0f1114'] },
  { id: 'larian', name: 'Larian', description: 'A launcher-inspired palette with bronze, gold and charcoal surfaces.', swatches: ['#d6a85f', '#17130f'] },
  { id: 'arcane', name: 'Arcane', description: 'A mystical violet palette for a magical atmosphere.', swatches: ['#a78bfa', '#11101a'] },
  { id: 'emerald', name: 'Emerald Grove', description: 'Deep forest greens with a bright emerald accent.', swatches: ['#34d399', '#0c1513'] },
  { id: 'bloodmoon', name: 'Blood Moon', description: 'Dark crimson surfaces with a dramatic red accent.', swatches: ['#f87171', '#170d10'] },
  { id: 'ocean', name: 'Astral Sea', description: 'Cool navy surfaces with a calm blue-cyan accent.', swatches: ['#38bdf8', '#0b121c'] },
  { id: 'icosa-green', name: 'ICOSA Green', description: 'The familiar ICOSA interface with a lively green accent and tactile buttons.', swatches: ['#58cc02', '#0f1510'] },
  { id: 'duolingo-dark', name: 'Duolingo Dark', description: 'A friendly dark palette inspired by Duolingo’s green, blue and purple accents.', swatches: ['#58cc02', '#13151a'] },
  { id: 'obsidian', name: 'Obsidian', description: 'A near-black interface with restrained graphite surfaces and a cool violet accent.', swatches: ['#8b7cff', '#07080b'] }
]

interface ThemeContextValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'icosa-theme'

function readTheme(): ThemeId {
  const value = window.localStorage.getItem(STORAGE_KEY)
  return THEMES.some((item) => item.id === value) ? (value as ThemeId) : 'classic'
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(readTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: (nextTheme) => setThemeState(nextTheme)
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
