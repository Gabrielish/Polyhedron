import { safeStorage } from 'electron'
import type Database from 'better-sqlite3'
import { SECRET_CONFIG_KEYS } from '../../shared/secret-config'

const PREFIX = 'os-encrypted:v1:'

function requireSecureStorage(): void {
  if (!safeStorage.isEncryptionAvailable() ||
    (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
    throw new Error('Secure credential storage is unavailable. Unlock your system keychain and try again.')
  }
}

export function encryptSecret(value: string): string {
  if (!value) return ''
  requireSecureStorage()
  return PREFIX + safeStorage.encryptString(value).toString('base64')
}

export function decryptSecret(value: string): string {
  if (!value) return ''
  if (!value.startsWith(PREFIX)) return value // Only for migration of existing local data.
  requireSecureStorage()
  return safeStorage.decryptString(Buffer.from(value.slice(PREFIX.length), 'base64'))
}

export function migrateStoredApiKeys(sqlite: Database.Database): void {
  const rows = sqlite.prepare('SELECT key, value FROM config').all() as Array<{ key: string; value: string | null }>
  const pending = rows.filter(row => (SECRET_CONFIG_KEYS as readonly string[]).includes(row.key) && row.value && !row.value.startsWith(PREFIX))
  if (!pending.length) return
  // Encrypt everything before changing any row, so a locked keychain cannot
  // leave a partly migrated database or discard an existing credential.
  const encrypted = pending.map(row => ({ key: row.key, value: encryptSecret(row.value!) }))
  sqlite.pragma('secure_delete = ON')
  sqlite.transaction(() => {
    const update = sqlite.prepare('UPDATE config SET value = ? WHERE key = ?')
    for (const row of encrypted) update.run(row.value, row.key)
  })()
  sqlite.pragma('wal_checkpoint(TRUNCATE)')
}
