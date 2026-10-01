export type TextSelection = { start: number; end: number }

export type LarianTag = { opening: string; closing?: string }

export function extractLarianTags(source: string): LarianTag[] {
  const tags: LarianTag[] = []
  const pattern = /(<LSTag\b[^>]*>[\s\S]*?<\/LSTag>|<i\b[^>]*>[\s\S]*?<\/i>|<br\s*\/?>)/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    const value = match[1]
    const opening = value.match(/^<(?:LSTag|i)\b[^>]*>/i)?.[0]
    if (opening) {
      const closing = value.match(/<\/(?:LSTag|i)>$/i)?.[0]
      if (closing) tags.push({ opening, closing })
    } else {
      tags.push({ opening: value })
    }
  }
  return tags
}

export function wrapSelectionWithTag(
  value: string,
  selection: TextSelection,
  tag: LarianTag
): { value: string; cursor: number } | null {
  if (selection.end > value.length) return null
  if (!tag.closing) {
    if (selection.start !== selection.end) return null
    return {
      value: value.slice(0, selection.start) + tag.opening + value.slice(selection.end),
      cursor: selection.start + tag.opening.length
    }
  }
  if (selection.start >= selection.end) return null
  const selectedText = value.slice(selection.start, selection.end)
  const nextValue =
    value.slice(0, selection.start) +
    tag.opening +
    selectedText +
    tag.closing +
    value.slice(selection.end)
  return {
    value: nextValue,
    cursor: selection.start + tag.opening.length + selectedText.length + tag.closing.length
  }
}
