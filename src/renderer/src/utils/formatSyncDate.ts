export function formatSyncDate(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date)
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date)
  return `${time}, ${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`
}
