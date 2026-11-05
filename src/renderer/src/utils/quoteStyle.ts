const QUOTED_SEGMENT_PATTERN =
  /(?:^|\s|\(|\[|\{)'[^'\r\n]+'(?=$|\s|[.,!?;:]|\)|\]|\})|"[^"\r\n]+"|“[^“”\r\n]+”|„[^„”\r\n]+”|‘[^‘’\r\n]+’|«[^«»\r\n]+»/gm

const QUOTE_STYLES = [
  'single-straight',
  'double-straight',
  'curly-double',
  'romanian-double',
  'curly-single',
  'guillemets'
] as const

export function quoteStyleSignature(value: string): string {
  const counts = new Map<string, number>()
  for (const match of value.matchAll(QUOTED_SEGMENT_PATTERN)) {
    const first = match[0].trimStart()[0]
    const style = first === "'"
      ? QUOTE_STYLES[0]
      : first === '"'
        ? QUOTE_STYLES[1]
        : first === '“'
          ? QUOTE_STYLES[2]
          : first === '„'
            ? QUOTE_STYLES[3]
            : first === '‘'
              ? QUOTE_STYLES[4]
              : QUOTE_STYLES[5]
    counts.set(style, (counts.get(style) ?? 0) + 1)
  }
  return JSON.stringify(
    QUOTE_STYLES.flatMap((style) => {
      const count = counts.get(style)
      return count ? [[style, count]] : []
    })
  )
}

export function quoteStyleSignaturesMismatch(sourceSignature: string, targetSignature: string): boolean {
  return (sourceSignature !== '[]' || targetSignature !== '[]') && sourceSignature !== targetSignature
}

export function hasQuoteStyleMismatch(source: string, target: string): boolean {
  if (!target.trim()) return false
  return quoteStyleSignaturesMismatch(quoteStyleSignature(source), quoteStyleSignature(target))
}
