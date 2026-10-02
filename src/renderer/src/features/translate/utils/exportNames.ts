import type { Language } from '@/types'

const BG3_OFFICIAL_LANGUAGE_FOLDERS: Record<string, string> = {
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
}

export function languageToBg3Folder(language: Language | undefined, fallback: string): string {
  const code = language?.code ?? fallback
  const officialFolder = BG3_OFFICIAL_LANGUAGE_FOLDERS[code]
  if (officialFolder) return officialFolder
  return (language?.name ?? fallback).replace(/[^a-zA-Z0-9]/g, '')
}

export function exportFileBaseName(modName: string, targetLang: string): string {
  const langSuffix = targetLang.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const baseName = `${modName} ${langSuffix}`
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
  return baseName || 'Traducao'
}
