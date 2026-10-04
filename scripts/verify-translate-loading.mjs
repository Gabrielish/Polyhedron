import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { performance } from 'node:perf_hooks'
import ts from 'typescript'

const read = file => fs.readFileSync(file, 'utf8')
function load(file, mocks = {}) {
  const exports = {}
  const compiled = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  } }).outputText
  vm.runInNewContext(compiled, { exports, require: name => mocks[name] })
  return exports
}
function declaration(file, name) {
  const source = read(file)
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name)
  return node.getText(ast).replace(/^export /, '')
}
const ctx = {}
vm.createContext(ctx)
vm.runInContext(ts.transpileModule([
  declaration('src/renderer/src/context/TranslationSession.tsx', 'isDeveloperNote'),
  declaration('src/renderer/src/components/translation/TranslationGrid.tsx', 'hasXmlTags'),
  declaration('src/renderer/src/components/translation/TranslationGrid.tsx', 'hasSquareBracketPlaceholder')
].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, ctx)
const { analyzeTranslateEntries } = load('src/renderer/src/features/translate/utils/entryStats.ts', {
  '@/context/TranslationSession': { isDeveloperNote: ctx.isDeveloperNote }
})
const { prepareSessionEntries } = load('src/renderer/src/features/translate/utils/prepareSessionEntries.ts')
const sources = [
  'plain text', '%%% internal', '|internal|<br>', '| not a note',
  '<i>text</i><br><b>bold</b>', '<LSTag Tooltip="x">tag</LSTag>',
  '{placeholder}', '[1]', '[bad\nplaceholder]', '[text]', '', ' Șță 日本語 '
]
const matches = ['none', 'mod-text', 'text', 'manual']
const rows = Array.from({ length: 60000 }, (_, i) => ({
  uid: `uid-${i % 47000}`, rowId: `row-${i}`, source: sources[i % sources.length],
  version: '1', target: i % 3 ? `translation ${i}` : ' ',
  matchType: matches[i % 4], needsReview: i % 5 === 0,
  reviewStatus: i % 7 === 0 ? 'verified' : 'not-verified',
  genderTargets: i % 11 === 0 ? { female: `female-${i}` } : undefined,
  history: i % 13 === 0 ? [{ id: String(i), target: 'previous' }] : undefined
}))
const equal = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)))
const start = performance.now()
for (const hide of [false, true]) {
  const visibleEntries = hide ? rows.filter(e => !ctx.isDeveloperNote(e.source)) : rows
  const expected = {
    visibleEntries,
    translated: visibleEntries.filter(e => e.target.trim()).length,
    untranslated: visibleEntries.filter(e => !e.target.trim()).length,
    verified: visibleEntries.filter(e => e.target.trim() && e.reviewStatus === 'verified').length,
    dictionary: visibleEntries.filter(e => ['text', 'mod-text'].includes(e.matchType)).length,
    tags: visibleEntries.filter(ctx.hasXmlTags).length,
    brackets: visibleEntries.filter(ctx.hasSquareBracketPlaceholder).length,
    needsReview: visibleEntries.filter(e => e.needsReview).length
  }
  equal(analyzeTranslateEntries(rows, hide), expected)
}
function previousMerge(entries, saved) {
  const byUid = new Map(saved?.map(e => [e.uid, e]))
  return entries.map(entry => {
    const previous = byUid.get(entry.uid)
    return previous ? { ...entry,
      target: previous.target.trim() || previous.needsReview ? previous.target : entry.target,
      matchType: previous.target.trim() || previous.matchType === 'manual' ? previous.matchType : entry.matchType,
      needsReview: previous.needsReview === true,
      reviewStatus: previous.reviewStatus ?? (previous.target?.trim() ? 'needs-review' : 'untranslated'),
      genderTargets: previous.genderTargets ?? entry.genderTargets,
      history: previous.history ?? entry.history
    } : entry
  }).map((entry, index) => ({ ...entry, rowId: `row-${index}` }))
}
const saved = rows.filter((_, i) => i % 2 === 0).map((e, i) => ({ ...e,
  target: i % 4 ? `saved-${i}` : '', reviewStatus: i % 3 ? 'verified' : undefined
}))
for (const overlay of [null, [], saved]) {
  equal(prepareSessionEntries(rows, overlay), previousMerge(rows, overlay))
  const loaded = rows.map(({ rowId, ...entry }) => entry)
  equal(prepareSessionEntries(loaded, overlay), previousMerge(loaded, overlay))
}
// Invalidate statistics after edits and after toggling developer-note visibility.
const edited = rows.map((e, i) => i === 0 ? { ...e, target: 'new', reviewStatus: 'verified' } : e)
assert.equal(analyzeTranslateEntries(edited, false).translated, analyzeTranslateEntries(rows, false).translated + 1)
assert.ok(analyzeTranslateEntries(rows, true).visibleEntries.length < rows.length)
console.log(JSON.stringify({ rows: rows.length, elapsedMs: Math.round(performance.now() - start) }))
console.log('Translate statistics and session overlay exactly match prior behavior; duplicates, blank/manual/review states, gender variants, history and edits passed.')
