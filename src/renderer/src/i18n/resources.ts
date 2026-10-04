import aiEn from '@/locales/en/ai.json'
import commonEn from '@/locales/en/common.json'
import dictionaryEn from '@/locales/en/dictionary.json'
import errorsEn from '@/locales/en/errors.json'
import extractEn from '@/locales/en/extract.json'
import mergeEn from '@/locales/en/merge.json'
import metricsEn from '@/locales/en/metrics.json'
import modsEn from '@/locales/en/mods.json'
import packageEn from '@/locales/en/package.json'
import settingsEn from '@/locales/en/settings.json'
import sidebarEn from '@/locales/en/sidebar.json'
import toastsEn from '@/locales/en/toasts.json'
import translateEn from '@/locales/en/translate.json'

export const translationNamespaces = [
  'ai',
  'common',
  'settings',
  'sidebar',
  'translate',
  'dictionary',
  'merge',
  'mods',
  'package',
  'extract',
  'errors',
  'toasts',
  'metrics'
] as const

export const resources = {
  en: {
    ai: aiEn,
    common: commonEn,
    settings: settingsEn,
    sidebar: sidebarEn,
    translate: translateEn,
    dictionary: dictionaryEn,
    merge: mergeEn,
    mods: modsEn,
    package: packageEn,
    extract: extractEn,
    errors: errorsEn,
    toasts: toastsEn,
    metrics: metricsEn
  }
} as const
