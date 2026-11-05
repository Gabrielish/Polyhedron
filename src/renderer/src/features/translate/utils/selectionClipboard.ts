export type SelectionCopyFormat =
  | 'ids'
  | 'source'
  | 'source-ids'
  | 'source-target'
  | 'source-target-ids'

export function formatSelectionForClipboard(
  entries: ReadonlyArray<{ uid: string; source: string; target: string }>,
  format: SelectionCopyFormat
): string {
  if (format === 'ids') return entries.map((entry) => entry.uid).join('\n')
  if (format === 'source') return entries.map((entry) => entry.source).join('\n')
  if (format === 'source-target') {
    return entries.map((entry) => `${entry.source}\n${entry.target}`).join('\n\n')
  }
  if (format === 'source-target-ids') {
    return entries.map((entry) => `${entry.source}\n${entry.target}\n${entry.uid}`).join('\n\n')
  }
  return entries.map((entry) => `${entry.uid}\n${entry.source}`).join('\n\n')
}
