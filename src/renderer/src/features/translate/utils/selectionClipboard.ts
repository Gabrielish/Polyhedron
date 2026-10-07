export type SelectionCopyFormat = 'ids' | 'source-ids'

export function formatSelectionForClipboard(
  entries: ReadonlyArray<{ uid: string; source: string }>,
  format: SelectionCopyFormat
): string {
  return format === 'ids'
    ? entries.map(entry => entry.uid).join('\n')
    : entries.map(entry => `${entry.uid}\n${entry.source}`).join('\n\n')
}
