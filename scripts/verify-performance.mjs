import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { Worker } from 'node:worker_threads'
import { performance } from 'node:perf_hooks'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText
function load(file, mocks = {}, source = read(file)) {
  const exports = {}
  vm.runInNewContext(
    compile(source),
    {
      exports,
      require: (name) => (name in mocks ? mocks[name] : require(name)),
      TextEncoder,
      performance,
      setTimeout,
      clearTimeout,
      setImmediate,
      DOMException,
      console,
      window: { api: { dialogue: { speakers: async () => ({}) } } }
    },
    { filename: file }
  )
  return exports
}
const equal = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected))

// Decode every real dialogue with the previous rules; order, details and edges must survive.
const raw = read('src/renderer/src/data/dialogReference.generated.json')
const data = JSON.parse(raw)
const dialogue = load('src/renderer/src/data/dialogReference.ts', {
  './dialogReference.generated.json?raw': raw
})
const expected = new Map()
for (const [id, node, hashes, next, detailIds] of data.nodes) {
  const name = data.dialogues[id]
  const list = expected.get(name) ?? []
  list.push({ node, hashes, next, details: detailIds.map((id) => data.details[id]) })
  expected.set(name, list)
}
for (const [name, nodes] of expected) equal(dialogue.getDialogueNodes(name), nodes)
equal(dialogue.getDialogueNodes('missing-dialogue'), [])
const catalog = JSON.parse(read('src/renderer/src/data/gameReference.generated.json'))
function hashText(text) {
  let hash = 14695981039346656037n
  for (const byte of new TextEncoder().encode(
    text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase()
  )) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  return hash.toString(16).padStart(16, '0')
}
for (const entry of catalog)
  for (const source of [entry.name, entry.description]) {
    const groups = (data.entries[hashText(source)] ?? []).map(([category, file, name, node]) => ({
      category: data.categories[category],
      file: data.files[file],
      dialogue: data.dialogues[name],
      node
    }))
    equal(dialogue.getDialogueGroups(source), groups)
  }
console.log(
  `Dialogue equivalence: ${expected.size} dialogues, ${data.nodes.length} nodes, ${catalog.length * 2} source lookups`
)

// Cooperative hashing must match Drive, support cancellation, and let timers run.
const { calculateSessionFingerprint } = load('src/renderer/src/utils/sessionFingerprint.ts')
const entries = Array.from({ length: 50000 }, (_, index) => ({
  uid: `uid-${index}`,
  target: `Traducere cu diacritice șțâ ${index}`,
  matchType: index % 2 ? 'manual' : 'none',
  needsReview: index % 3 === 0,
  reviewStatus: index % 2 ? 'verified' : undefined,
  history: [{ id: String(index), value: 'istoric', changedAt: index }]
}))
let hash = 2166136261
for (const entry of entries) {
  const value = `${entry.uid}\u0000${entry.target}\u0000${entry.matchType}\u0000${entry.needsReview}\u0000${entry.reviewStatus ?? ''}\u0000${JSON.stringify(entry.history ?? [])}`
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
}
let timerRan = false
setTimeout(() => {
  timerRan = true
}, 0)
assert.equal(await calculateSessionFingerprint(entries), (hash >>> 0).toString(16))
assert.ok(timerRan)
assert.equal(await calculateSessionFingerprint([]), '811c9dc5')
const controller = new AbortController()
const cancelled = calculateSessionFingerprint(entries, controller.signal)
controller.abort()
await assert.rejects(cancelled, (error) => error.name === 'AbortError')
console.log('Fingerprint: exact Drive equality, yielding and cancellation passed')

// Real virtualizer geometry, including duplicate catalog names and every category transition.
const { Virtualizer } = require('@tanstack/react-virtual')
for (const category of [undefined, ...new Set(catalog.map((entry) => entry.category))]) {
  const rows = catalog
    .map((entry, index) => ({ entry, key: `${entry.category}:${entry.name}:${index}` }))
    .filter((row) => !category || row.entry.category === category)
  for (const offset of [0, 560, Math.max(0, rows.length * 56 - 560)]) {
    const virtual = new Virtualizer({
      count: rows.length,
      getScrollElement: () => null,
      estimateSize: () => 56,
      getItemKey: (index) => rows[index].key,
      initialRect: { width: 500, height: 560 },
      initialOffset: offset,
      overscan: 8,
      scrollToFn() {},
      observeElementRect() {},
      observeElementOffset() {}
    })
    const items = virtual.getVirtualItems()
    assert.ok(items.length > 0 && items.length < 40)
    assert.equal(new Set(items.map((item) => item.key)).size, items.length)
    for (const item of items) {
      assert.equal(item.size, 56)
      assert.equal(item.start, item.index * 56)
      assert.equal(rows[item.index].entry.category, category ?? rows[item.index].entry.category)
    }
    for (let i = 1; i < items.length; i++) assert.ok(items[i].start >= items[i - 1].start + 52 + 4)
  }
}
console.log(
  'Game Data: unique keys, bounded rendered rows, spacing, all categories and scroll offsets passed'
)

// Run the actual file worker against disposable data, never the user's workspace.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'polyhedron-perf-check-'))
const workerSource = compile(read('src/main/workers/file-task.worker.ts'))
const runFileTask = (task) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(workerSource, { eval: true, workerData: task })
    worker.once('message', resolve)
    worker.once('error', reject)
  })
try {
  const handlers = new Map()
  const session = load('src/main/ipc/session.ipc.ts', {
    electron: { ipcMain: { handle: (name, callback) => handlers.set(name, callback) } },
    '../utils/app-paths': { projectPath: (...parts) => path.join(temporary, ...parts) },
    '../services/file-task.service': { runFileTask }
  })
  session.registerSessionHandlers()
  const save = handlers.get('session:save'),
    loadSession = handlers.get('session:load')
  const first = save(null, { key: 'project|en|ro', entries: entries.slice(0, 100) })
  const last = save(null, { key: 'project|en|ro', entries: entries.slice(0, 200) })
  equal(await loadSession(null, { key: 'project|en|ro' }), entries.slice(0, 200))
  await Promise.all([first, last, session.flushSessionSaves()])
  const archive = path.join(temporary, 'workspace.zip')
  await runFileTask({
    kind: 'zip',
    sourceDir: path.join(temporary, 'sessions'),
    outputPath: archive
  })
  const restored = path.join(temporary, 'restored')
  await runFileTask({ kind: 'extract', inputPath: archive, destinationDir: restored })
  const file = fs.readdirSync(restored)[0]
  equal(
    await runFileTask({ kind: 'load-session', filePath: path.join(restored, file) }),
    entries.slice(0, 200)
  )
  assert.ok(
    !fs.readdirSync(path.join(temporary, 'sessions')).some((name) => name.endsWith('.pending'))
  )
  console.log('Session workers: concurrent saves, load ordering, flush and ZIP round-trip passed')
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}

// Dictionary cache must refresh for both local and external mutations.
const { SimilarityIndex } = load('src/main/services/similarity.service.ts')
const handlers = new Map()
let revision = '0:1',
  corpus = [{ source: 'hello world', target: 'salut' }],
  reads = 0
const database = {}
const dictionary = load('src/main/ipc/dictionary.ipc.ts', {
  '../services/dictionary-save.service': {},
  electron: { ipcMain: { handle: (name, callback) => handlers.set(name, callback) } },
  '../services/import.service': {},
  '../utils/dictionaryCsv': {},
  '../utils/csv': {},
  '../services/similarity.service': { SimilarityIndex },
  '../database/connection': { getDatabaseRevision: () => ({ database, revision }) }
})
dictionary.registerDictionaryHandlers({
  dictionary: {
    getAllForSimilarity: () => {
      reads++
      return corpus
    }
  }
})
const similar = handlers.get('dictionary:similar')
const query = { text: 'hello world', lang1: 'en', lang2: 'ro', limit: 5 }
similar(null, query)
similar(null, query)
assert.equal(reads, 1)
for (const stamp of ['1:1', '1:2']) {
  revision = stamp
  corpus = [{ source: 'hello world', target: stamp }]
  assert.equal(similar(null, query)[0].translated, stamp)
}
assert.equal(reads, 3)
console.log('Similarity: reuse and local/external invalidation passed')
