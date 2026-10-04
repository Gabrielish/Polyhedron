import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  vm.runInNewContext(code, { exports, ...globals })
  return exports
}
const entities = load('src/renderer/src/lib/xmlEntities.ts')
const calls = []
let sessionFailure = false
let databaseFailure = false
let revision = 0
const { saveTranslations, DatabaseSaveError } = load(
  'src/renderer/src/features/translate/utils/saveTranslations.ts',
  {
    require: () => entities,
    window: {
      api: {
        session: {
          save: async (payload) => {
            calls.push(['session', payload])
            if (sessionFailure) throw new Error('session write failed')
          }
        },
        dictionary: {
          revision: async () => String(revision),
          bulkUpsert: async (payload) => {
            calls.push(['database', payload])
            if (databaseFailure) throw new Error('database write failed')
            revision++
          }
        }
      }
    }
  }
)
const session = {
  storedPath: 'project.xml',
  sourceLang: 'en',
  targetLang: 'ro',
  modName: 'Project',
  entries: [
    {
      rowId: 'row-0',
      uid: 'translated',
      source: '<b>Source & text</b>',
      target: 'Traducere & text',
      genderTargets: { female: 'Feminin' },
      matchType: 'manual',
      needsReview: true,
      reviewStatus: 'verified',
      history: [{ value: 'previous' }]
    },
    {
      rowId: 'row-1',
      uid: 'empty',
      source: 'Empty',
      target: ' ',
      matchType: 'none',
      needsReview: false
    }
  ]
}
assert.equal(await saveTranslations(session), 1)
assert.deepEqual(
  calls.map(([kind]) => kind),
  ['session', 'database']
)
assert.equal(calls[0][1].key, 'project.xml|en|ro')
assert.equal(
  JSON.stringify(calls[0][1].entries),
  JSON.stringify(session.entries.map(({ rowId, ...entry }) => entry))
)
assert.equal(calls[1][1].length, 1)
assert.equal(calls[1][1][0].textLanguage1, '&lt;b&gt;Source &amp; text&lt;/b&gt;')
assert.equal(calls[1][1][0].textLanguage2, 'Traducere &amp; text')
calls.length = 0
assert.equal(await saveTranslations(session), 1)
assert.deepEqual(
  calls.map(([kind]) => kind),
  ['session']
)
calls.length = 0
const edited = {
  ...session,
  entries: [{ ...session.entries[0], target: 'Edited' }, session.entries[1]]
}
assert.equal(await saveTranslations(edited), 1)
assert.equal(calls[1][1].length, 1)
assert.equal(calls[1][1][0].textLanguage2, 'Edited')
calls.length = 0
revision++
await saveTranslations(edited)
assert.deepEqual(
  calls.map(([kind]) => kind),
  ['session', 'database']
)
calls.length = 0
assert.equal(await saveTranslations({ ...session, entries: [session.entries[1]] }), 0)
assert.deepEqual(
  calls.map(([kind]) => kind),
  ['session']
)
calls.length = 0
sessionFailure = true
await assert.rejects(saveTranslations(session), /session write failed/)
assert.deepEqual(
  calls.map(([kind]) => kind),
  ['session']
)
calls.length = 0
sessionFailure = false
databaseFailure = true
revision++
await assert.rejects(saveTranslations(session), (error) => error instanceof DatabaseSaveError)
assert.deepEqual(
  calls.map(([kind]) => kind),
  ['session', 'database']
)
console.log(
  'Combined Save: snapshot, metadata, encoding, incremental updates, no-op saves, external invalidation and partial failure passed'
)
