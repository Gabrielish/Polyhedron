export type Appearance = { accent: string; buttonTextColor: 'white' | 'black' }
export const APPEARANCE_STORAGE_KEY = 'polyhedron.desktop-appearance'
export const DEFAULT_APPEARANCE: Appearance = { accent: '#ED1C24', buttonTextColor: 'white' }

export function normalizeAppearance(value: unknown): Appearance | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Appearance>
  if (typeof candidate.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(candidate.accent)) return null
  if (candidate.buttonTextColor !== 'white' && candidate.buttonTextColor !== 'black') return null
  return { accent: candidate.accent.toUpperCase(), buttonTextColor: candidate.buttonTextColor }
}

export function readAppearance(): Appearance {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? 'null')) ?? DEFAULT_APPEARANCE
  } catch { return DEFAULT_APPEARANCE }
}

export function applyAppearance(appearance: Appearance): void {
  const root = window.document.documentElement
  root.style.setProperty('--accent', appearance.accent)
  root.style.setProperty('--accent-foreground', appearance.buttonTextColor === 'black' ? '#101010' : '#FFFFFF')
  const rgb = [1, 3, 5].map(start => parseInt(appearance.accent.slice(start, start + 2), 16)).join(' ')
  root.style.setProperty('--accent-rgb', rgb)
  try { localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance)) } catch { /* Private/full storage must not prevent theming. */ }
}
