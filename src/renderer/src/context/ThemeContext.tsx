import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeId = 'classic' | 'liquid-glass'

export const THEMES: Array<{ id: ThemeId; name: string; description: string; swatches: string[] }> = [
  { id: 'classic', name: 'Classic', description: 'The original Polyhedron dark interface with its signature red accent.', swatches: ['#ed1c24', '#0f1114'] },
  { id: 'liquid-glass', name: 'Liquid Glass', description: 'A dark translucent interface with soft blur, glass surfaces and signature red highlights.', swatches: ['#ed1c24', '#0a0d12'] }
]

interface ThemeContextValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'icosa-theme'

function readTheme(): ThemeId {
  const value = window.localStorage.getItem(STORAGE_KEY)
  return value === 'liquid-glass' ? 'liquid-glass' : 'liquid-glass'
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
