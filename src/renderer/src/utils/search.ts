/** Remove accents while preserving case for case-sensitive matching. */
export function stripSearchDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Normalize user-entered search text so Romanian diacritics are optional. */
export function normalizeSearchText(value: string): string {
  return stripSearchDiacritics(value).normalize('NFD').toLocaleLowerCase()
}
