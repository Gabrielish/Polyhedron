import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { parentPort, workerData } from 'node:worker_threads'
import { DictionaryRepository, type UpsertParams } from '../database/repositories/dictionary.repo'
import * as schema from '../database/schema'

type SaveJob = { dbPath: string; entries: UpsertParams[] }
function save({ dbPath, entries }: SaveJob): void {
  try {
    const sqlite = new Database(dbPath)
    try {
      sqlite.pragma('foreign_keys = ON')
      sqlite.pragma('busy_timeout = 10000')
      new DictionaryRepository(drizzle(sqlite, { schema })).bulkUpsert(entries)
    } finally {
      sqlite.close()
    }
    parentPort!.postMessage({ success: true })
  } catch (error) {
    parentPort!.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
// One-shot mode is useful for round-trip checks; the app reuses the message loop.
// Each job closes its connection so workspace import can replace the database.
if (workerData) save(workerData as SaveJob)
else parentPort!.on('message', save)
