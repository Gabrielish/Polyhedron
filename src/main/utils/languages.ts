// Larian's localization directory names differ from the display names for a
// few official BG3 locales. Keep this mapping centralized for imports, package
// extraction, and translation pipelines.
export const BG3_OFFICIAL_LANGUAGE_FOLDERS = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  'es-419': 'LatinSpanish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  pl: 'Polish',
  'pt-BR': 'BrazilianPortuguese',
  ru: 'Russian',
  tr: 'Turkish',
  uk: 'Ukrainian',
  'zh-CN': 'Chinese',
  'zh-TW': 'ChineseTraditional'
} as const

export function toBg3LanguageFolder(code: string, name?: string | null): string {
  if (Object.hasOwn(BG3_OFFICIAL_LANGUAGE_FOLDERS, code)) {
    return BG3_OFFICIAL_LANGUAGE_FOLDERS[code as keyof typeof BG3_OFFICIAL_LANGUAGE_FOLDERS]
  }
  return (name ?? code).replace(/[^a-zA-Z0-9]/g, '')
}

export function normalizeLangs(a: string, b: string): [string, string, swapped: boolean] {
  const swapped = a > b
  return swapped ? [b, a, true] : [a, b, false]
}
