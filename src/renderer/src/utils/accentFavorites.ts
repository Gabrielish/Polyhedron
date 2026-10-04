export const ACCENT_FAVORITES_STORAGE_KEY = 'polyhedron-accent-favorites'
export const DEFAULT_ACCENT_FAVORITES: Array<string | null> = [
  '#8C52FF', '#A7F175', '#ED1C24', null, null
]

export function parseAccentFavorites(raw: string | null | undefined): Array<string | null> {
  try {
    const values: unknown = JSON.parse(raw ?? '')
    if (!Array.isArray(values)) return [...DEFAULT_ACCENT_FAVORITES]
    return Array.from({ length: 5 }, (_, index) => {
      if (index < 3) return DEFAULT_ACCENT_FAVORITES[index]
      const value = values[index]
      return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
        ? value.toUpperCase()
        : null
    })
  } catch {
    return [...DEFAULT_ACCENT_FAVORITES]
  }
}
