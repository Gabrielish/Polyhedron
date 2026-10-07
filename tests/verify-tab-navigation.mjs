import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import ts from 'typescript'

const read = (file) => fs.readFileSync(file, 'utf8')
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText
function load(source, mocks = {}) {
  const exports = {}
  vm.runInNewContext(compile(source), {
    exports,
    require: (name) => mocks[name],
    TextEncoder,
    Map,
    Object
  })
  return exports
}
const equal = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b))
const catalog = JSON.parse(read('src/renderer/src/data/gameReference.generated.json'))
const normalize = (value) =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFD')
    .toLocaleLowerCase()
function factory(source, name) {
  const file = ts.createSourceFile(
    'page.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  let found
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) {
      const call = node.initializer
      found =
        call.arguments[call.expression.getText(file) === 'useRetainedMemo' ? 1 : 0].getText(file)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  assert.ok(found, name)
  return found
}
function timed(fn) {
  const start = performance.now()
  const result = fn()
  return { result, ms: +(performance.now() - start).toFixed(1) }
}

// Execute the actual previous/current variant-index factories on the real catalog.
const spellCatalog = catalog.filter((entry) => entry.category === 'Spell')
const oldPage = execFileSync('git', ['show', 'HEAD:src/renderer/src/pages/SpellsPage.tsx'], {
  encoding: 'utf8'
})
const newPage = read('src/renderer/src/pages/SpellsPage.tsx')
const runVariants = (source) =>
  vm.runInNewContext(compile(`(${factory(source, 'variantsBySpellName')})()`), {
    spellCatalog,
    normalize
  })
const oldVariants = timed(() => runVariants(oldPage))
const newVariants = timed(() => runVariants(newPage))
equal([...newVariants.result], [...oldVariants.result])

// Execute the real consistency grouping factories; sources/variants/statuses survive.
const oldConsistency = execFileSync('git', ['show', 'HEAD:src/renderer/src/pages/ConsistencyPage.tsx'], { encoding: 'utf8' })
const newConsistency = read('src/renderer/src/pages/ConsistencyPage.tsx')
function helpers(source) {
  const file = ts.createSourceFile('consistency.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  return file.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text !== 'ConsistencyPage')
    .map(node => node.getText(file)).join('\n')
}
const oldSpeakers = load(execFileSync('git', ['show', 'HEAD:src/renderer/src/utils/speakerMetadata.ts'], { encoding: 'utf8' }))
const newSpeakers = load(read('src/renderer/src/utils/speakerMetadata.ts'))
const consistencyRows = Array.from({ length: 30000 }, (_, i) => ({
  source: catalog[i % catalog.length].description,
  target: `Traducere ${Math.floor(i / catalog.length) % 3}`,
  rowId: String(i), matchType: i % 2 ? 'manual' : 'text', history: [{changedAt: i}]
}))
const runGroups = (source, speakers) => vm.runInNewContext(compile(`${helpers(source)}\n(${factory(source, 'groups')})()`), {
  session: { entries: consistencyRows }, getSpeakerForDialogue: speakers.getSpeakerForDialogue,
  normalizeSearchText: value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFD').toLocaleLowerCase()
})
const beforeGroups = timed(() => runGroups(oldConsistency, oldSpeakers))
const afterGroups = timed(() => runGroups(newConsistency, newSpeakers))
equal(afterGroups.result, beforeGroups.result)

// Exact FNV-1a 64-bit compatibility, including non-ASCII and long strings.
const hashModule = load(
  read('src/renderer/src/data/dialogReference.ts') + '\nexport { hashText }',
  {
    './dialogReference.generated.json?raw': '{}'
  }
)
const { oldHash } = load(`export const oldHash = value => {
  let hash = 14695981039346656037n
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  return hash.toString(16).padStart(16, '0')
}`)
const sources = [
  '',
  'șțîâă😀',
  '長い文字列',
  '\u0000\ufffd',
  'a'.repeat(10000),
  ...catalog.flatMap((entry) => [entry.name, entry.description])
]
const beforeHash = timed(() => sources.map(oldHash))
const afterHash = timed(() => sources.map(hashModule.hashText))
equal(afterHash.result, beforeHash.result)
assert.equal(
  read('src/renderer/src/data/dialogReference.ts'),
  read('scripts/templates/dialogReference.ts')
)

// Compare substring fallback with the old find() including empty/duplicate sources.
const { createSourceResolver } = load(read('src/renderer/src/utils/sourceResolver.ts'))
const rows = Array.from({ length: 12000 }, (_, i) => ({
  source: `Unrelated session sentence ${i} șț`,
  rowId: i
}))
rows.push({ source: 'foo', rowId: 12000 }, { source: '<b>foo</b>', rowId: 12001 })
const bySource = new Map()
const fallback = new Map()
for (const row of rows) {
  const key = normalize(row.source)
  if (!fallback.has(key)) fallback.set(key, [row])
  if (!key) continue
  const list = bySource.get(key) ?? []
  list.push(row)
  bySource.set(key, list)
}
const queries = [
  'foo',
  'prefix foo suffix',
  'Unrelated session sentence 4 șț',
  '',
  'no match',
  ...catalog.slice(0, 60).flatMap((entry) => [entry.name, entry.description])
]
const previousResolve = (source) =>
  bySource.get(normalize(source))?.[0] ??
  rows.find((row) => {
    const candidate = normalize(row.source)
    const target = normalize(source)
    return candidate === target || candidate.includes(target) || target.includes(candidate)
  })
const resolver = createSourceResolver(bySource, normalize, fallback)
const beforeResolve = timed(() => queries.map(previousResolve))
const afterResolve = timed(() => queries.map(resolver))
equal(afterResolve.result, beforeResolve.result)
const warmResolve = timed(() => queries.map(resolver))
equal(warmResolve.result, beforeResolve.result)
const withEmpty = new Map([['', [{ source: '', rowId: -1 }]], ...fallback])
assert.equal(createSourceResolver(bySource, normalize, withEmpty)('missing').rowId, -1)

// Remount reuse, target edits, source replacement, and separate tab caches.
const { useRetainedMemo } = load(read('src/renderer/src/hooks/useRetainedMemo.ts'), {
  react: { useMemo: (factory) => factory() }
})
let builds = 0
const build = () => {
  builds++
  return {}
}
const first = useRetainedMemo('test:rows', build, [rows])
assert.equal(useRetainedMemo('test:rows', build, [rows]), first)
assert.equal(builds, 1)
const edited = [...rows]
assert.notEqual(useRetainedMemo('test:rows', build, [edited]), first)
assert.equal(builds, 2)
useRetainedMemo('other-tab:rows', build, [edited])
assert.equal(builds, 3)

console.log(
  JSON.stringify({
    spellCatalogRows: spellCatalog.length,
    variantsBeforeMs: oldVariants.ms,
    variantsAfterMs: newVariants.ms,
    consistencyRows: consistencyRows.length,
    consistencyBeforeMs: beforeGroups.ms,
    consistencyAfterMs: afterGroups.ms,
    hashedSources: sources.length,
    hashBeforeMs: beforeHash.ms,
    hashAfterMs: afterHash.ms,
    fallbackSessionRows: rows.length,
    fallbackBeforeMs: beforeResolve.ms,
    fallbackAfterMs: afterResolve.ms,
    fallbackWarmMs: warmResolve.ms
  })
)
console.log(
  'Tab indexes: exact variant/hash/fallback equivalence, remount reuse and invalidation passed'
)
