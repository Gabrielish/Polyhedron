import path from 'node:path'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { dictionaryTextKey } from '../utils/dictionaryText'
import * as schema from './schema'
import { seedLanguages } from './seeds/languages.seed'
import { seedPromptSlots } from './seeds/prompt-slots.seed'

type AppDb = ReturnType<typeof drizzle<typeof schema>>

interface DictionaryTextRow {
  id: number
  text_language1: string
  text_language2: string
}

let _db: AppDb | null = null
let _sqlite: Database.Database | null = null

export function getDb(): AppDb {
  if (!_db) {
    const dbPath = path.join(app.getPath('userData'), 'icosa.db')
    _sqlite = new Database(dbPath)
    _sqlite.pragma('journal_mode = WAL')
    _sqlite.pragma('foreign_keys = ON')
    _db = drizzle(_sqlite, { schema })
    migrate(_db, { migrationsFolder: getMigrationsFolder() })
    backfillDictionaryTextKeys(_sqlite)
    seedLanguages(_db)
    seedPromptSlots(_db)
  }
  return _db
}

export function closeDb(): void {
  _sqlite?.close()
  _sqlite = null
  _db = null
}

export async function backupDatabase(outputPath: string): Promise<void> {
  getDb()
  if (!_sqlite) throw new Error('Database is not initialized')
  _sqlite.pragma('wal_checkpoint(FULL)')
  await _sqlite.backup(outputPath)
}

// Backfill text_language1_key / text_language2_key for rows whose text contains XML
// entities (e.g. &apos;, &amp;). The SQL migration uses lower(trim(...)) which cannot
// decode entities, so this pass corrects any affected rows after the migrator runs.
function backfillDictionaryTextKeys(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare(
      "SELECT id, text_language1, text_language2 FROM dictionary WHERE text_language1 LIKE '%&%' OR text_language2 LIKE '%&%'"
    )
    .all() as DictionaryTextRow[]

  if (rows.length === 0) return

  const update = sqlite.prepare(
    'UPDATE dictionary SET text_language1_key = ?, text_language2_key = ? WHERE id = ?'
  )

  sqlite.transaction(() => {
    for (const row of rows) {
      update.run(
        dictionaryTextKey(row.text_language1),
        dictionaryTextKey(row.text_language2),
        row.id
      )
    }
  })()
}

function getMigrationsFolder(): string {
  const base = is.dev ? app.getAppPath() : app.getAppPath().replace('app.asar', 'app.asar.unpacked')
  return path.join(base, 'drizzle')
}
