import Database from 'better-sqlite3'
import { isSensitiveConfigKey } from '../../shared/secret-config'

export function sanitizeWorkspaceDatabase(dbPath: string): void {
  const sqlite = new Database(dbPath)
  try {
    sqlite.pragma('secure_delete = ON')
    const rows = sqlite.prepare('SELECT key FROM config').all() as Array<{ key: string }>
    const remove = sqlite.prepare('DELETE FROM config WHERE key = ?')
    sqlite.transaction(() => {
      for (const row of rows) if (isSensitiveConfigKey(row.key)) remove.run(row.key)
    })()
    // Deleting a row alone can leave its content recoverable in SQLite pages.
    sqlite.pragma('wal_checkpoint(TRUNCATE)')
    sqlite.exec('VACUUM')
    sqlite.pragma('wal_checkpoint(TRUNCATE)')
  } finally { sqlite.close() }
}

export function restoreLocalSecrets(dbPath: string, secrets: Array<{ key: string; value: string | null }>): void {
  const sqlite = new Database(dbPath)
  try {
    const insert = sqlite.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    sqlite.transaction(() => {
      for (const row of secrets) insert.run(row.key, row.value)
    })()
  } finally { sqlite.close() }
}
