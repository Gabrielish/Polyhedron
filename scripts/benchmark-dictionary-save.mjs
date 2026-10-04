import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { Worker } from 'node:worker_threads'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const loaded = new Map()
let windowMock
function load(file) {
  file = path.resolve(file)
  if (loaded.has(file)) return loaded.get(file)
  const exports = {}
  loaded.set(file, exports)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText
  vm.runInNewContext(code, {
    exports,
    window: windowMock,
    require: (name) =>
      name.startsWith('.')
        ? load(path.resolve(path.dirname(file), `${name}.ts`))
        : name.startsWith('@/')
          ? load(path.resolve('src/renderer/src', `${name.slice(2)}.ts`))
          : require(name)
  })
  return exports
}
const Database = require('better-sqlite3')
const { drizzle } = require('drizzle-orm/better-sqlite3')
const schema = load('src/main/database/schema.ts')
const { DictionaryRepository } = load('src/main/database/repositories/dictionary.repo.ts')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'polyhedron-save-bench-'))
const dbPath = path.join(directory, 'test.db')
const sqlite = new Database(dbPath)
let persistentWorker
try {
  sqlite.pragma('journal_mode = WAL')
  sqlite.exec(`
    CREATE TABLE language (code TEXT PRIMARY KEY);
    CREATE TABLE mod (name TEXT PRIMARY KEY);
    INSERT INTO language VALUES ('en'), ('ro');
    INSERT INTO mod VALUES ('Project');
    CREATE TABLE dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language1 TEXT NOT NULL REFERENCES language(code), language2 TEXT NOT NULL REFERENCES language(code),
      text_language1 TEXT NOT NULL, text_language2 TEXT NOT NULL,
      text_language1_key TEXT NOT NULL, text_language2_key TEXT NOT NULL,
      mod_name TEXT REFERENCES mod(name), uid TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX dictionary_uid_idx ON dictionary(language1, language2, uid);
  `)
  const repo = new DictionaryRepository(drizzle(sqlite, { schema }))
  const rows = Array.from({ length: 10000 }, (_, index) => ({
    sourceLang: 'en',
    targetLang: 'ro',
    sourceText: `Source ${index}`,
    targetText: `Traducere ${index}`,
    uid: `uid-${index}`,
    modName: 'Project'
  }))
  let start = performance.now()
  repo.bulkUpsert(rows)
  const firstMs = performance.now() - start
  const changes = () => sqlite.prepare('SELECT total_changes() AS count').get().count
  const before = changes()
  start = performance.now()
  repo.bulkUpsert(rows)
  const unchangedMs = performance.now() - start
  assert.equal(changes(), before)
  start = performance.now()
  repo.bulkUpsert([{ ...rows[5000], targetText: 'Edited' }])
  const incrementalMs = performance.now() - start
  assert.equal(changes(), before + 1)
  assert.equal(
    sqlite.prepare("SELECT text_language2 FROM dictionary WHERE uid = 'uid-5000'").get()
      .text_language2,
    'Edited'
  )
  // Reverse language direction must update the same record, preserving canonical columns.
  repo.bulkUpsert([
    {
      sourceLang: 'ro',
      targetLang: 'en',
      sourceText: 'Edited',
      targetText: 'Source revised',
      uid: 'uid-5000',
      modName: 'Project'
    }
  ])
  assert.equal(
    sqlite.prepare("SELECT text_language1 FROM dictionary WHERE uid = 'uid-5000'").get()
      .text_language1,
    'Source revised'
  )
  const noUid = {
    sourceLang: 'en',
    targetLang: 'ro',
    sourceText: '<b>Fallback</b>',
    targetText: 'Prima',
    modName: 'Project'
  }
  repo.bulkUpsert([noUid])
  repo.bulkUpsert([{ ...noUid, targetText: 'A doua' }])
  assert.equal(
    sqlite
      .prepare("SELECT count(*) AS count FROM dictionary WHERE text_language1 = '<b>Fallback</b>'")
      .get().count,
    1
  )
  assert.equal(
    sqlite
      .prepare("SELECT text_language2 FROM dictionary WHERE text_language1 = '<b>Fallback</b>'")
      .get().text_language2,
    'A doua'
  )
  const workerPath = path.resolve('out/main/dictionary-save.worker.js')
  assert.ok(fs.existsSync(workerPath), 'Build first with electron-vite')
  await new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { dbPath, entries: [{ ...rows[6000], targetText: 'Worker saved' }] }
    })
    worker.once('message', resolve)
    worker.once('error', reject)
  })
  assert.equal(
    sqlite.prepare("SELECT text_language2 FROM dictionary WHERE uid = 'uid-6000'").get()
      .text_language2,
    'Worker saved'
  )
  const runWorker = (file, workerData) =>
    new Promise((resolve, reject) => {
      const worker = new Worker(path.resolve(file), { workerData })
      worker.once('message', resolve)
      worker.once('error', reject)
    })
  const sessionFile = path.join(directory, 'session.json')
  persistentWorker = new Worker(workerPath)
  const saveDatabase = (entries) =>
    new Promise((resolve, reject) => {
      persistentWorker.once('message', (result) =>
        result.error ? reject(new Error(result.error)) : resolve(result)
      )
      persistentWorker.once('error', reject)
      persistentWorker.postMessage({ dbPath, entries })
    })
  windowMock = {
    api: {
      session: {
        save: ({ entries }) =>
          runWorker('out/main/file-task.worker.js', {
            kind: 'save-session',
            filePath: sessionFile,
            entries
          })
      },
      dictionary: {
        revision: async () => String(sqlite.pragma('data_version', { simple: true })),
        bulkUpsert: (entries) =>
          saveDatabase(
            entries.map((entry) => ({
              sourceLang: entry.language1,
              targetLang: entry.language2,
              sourceText: entry.textLanguage1,
              targetText: entry.textLanguage2,
              uid: entry.uid,
              modName: entry.modName
            }))
          )
      }
    }
  }
  const { saveTranslations } = load('src/renderer/src/features/translate/utils/saveTranslations.ts')
  const session = {
    storedPath: 'test.xml',
    modName: 'Project',
    sourceLang: 'en',
    targetLang: 'ro',
    entries: rows.map((row, index) => ({
      rowId: `row-${index}`,
      uid: row.uid,
      source: row.sourceText,
      target: row.targetText,
      matchType: 'manual',
      needsReview: false
    }))
  }
  await saveTranslations(session)
  start = performance.now()
  await windowMock.api.session.save({
    entries: session.entries.map(({ rowId, ...entry }) => entry)
  })
  const sessionOnlyMs = performance.now() - start
  start = performance.now()
  await saveTranslations(session)
  const combinedUnchangedMs = performance.now() - start
  start = performance.now()
  await saveTranslations({
    ...session,
    entries: session.entries.map((entry, index) =>
      index === 99 ? { ...entry, target: 'Final edit' } : entry
    )
  })
  const combinedOneEditMs = performance.now() - start
  assert.equal(
    sqlite.prepare("SELECT text_language2 FROM dictionary WHERE uid = 'uid-99'").get()
      .text_language2,
    'Final edit'
  )
  console.log(
    JSON.stringify({
      syntheticRows: rows.length,
      firstSaveMs: +firstMs.toFixed(1),
      unchangedDatabaseScanMs: +unchangedMs.toFixed(1),
      oneChangedTranslationMs: +incrementalMs.toFixed(1),
      sessionOnlyMs: +sessionOnlyMs.toFixed(1),
      combinedUnchangedMs: +combinedUnchangedMs.toFixed(1),
      combinedOneEditMs: +combinedOneEditMs.toFixed(1)
    })
  )
  console.log(
    'SQLite: no-op writes, incremental update, reverse languages, UID-less matching and built worker passed'
  )
} finally {
  if (persistentWorker) await persistentWorker.terminate()
  sqlite.close()
  fs.rmSync(directory, { recursive: true, force: true })
}
