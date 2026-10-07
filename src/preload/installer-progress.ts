import type { InstallerStatus } from './installer-types'

// Never interpret an absent/partially written field as completion. NSIS alone
// confirms success; even progress=100 while still installing stays below 100.
export function installerProgress(state: InstallerStatus['state'], value: unknown): number | undefined {
  if (state === 'done') return 100
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value)) return undefined
  const progress = Number(value)
  return Number.isFinite(progress) && progress >= 0 ? Math.min(99, progress) : undefined
}
