// Run the hook's actual asynchronous effect without bundling/building the app.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const text = fs.readFileSync(path.join(root, 'src/renderer/src/hooks/useTranslationSuggestionAvailability.ts'), 'utf8')
const tree = ts.createSourceFile('hook.ts', text, ts.ScriptTarget.Latest, true)
let body
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect') body = node.arguments[0].body.getText(tree).slice(1, -1)
  ts.forEachChild(node, visit)
}
visit(tree)
assert(body)
const effect = new Function('window', 'setAvailable', body)
const tick = () => new Promise(resolve => setImmediate(resolve))
async function run() {
  const pending = [], updates = []
  let changed, unsubscribed = false
  const cleanup = effect({ api: { translationSuggestions: {
    list: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    onChanged: callback => { changed = callback; return () => { unsubscribed = true } }
  } } }, value => updates.push(value))
  const settle = async sources => { pending.shift().resolve(sources); await tick(); return updates.at(-1) }
  assert.equal(await settle([]), false)
  for (const [sources, expected] of [
    [[{ enabled: false, available: true }], false],
    [[{ enabled: true, available: false }], false],
    [[{ enabled: true, available: true }], true],
    [[{ enabled: false, available: true }, { enabled: true, available: true }], true],
    [[], false]
  ]) {
    changed()
    assert.equal(await settle(sources), expected)
  }
  changed(); changed()
  const old = pending.shift(), latest = pending.shift()
  latest.resolve([{ enabled: true, available: true }]); await tick()
  const count = updates.length
  old.resolve([]); await tick()
  assert.equal(updates.length, count, 'Ignore stale list responses')
  assert.equal(updates.at(-1), true)
  changed(); pending.shift().reject(Error('fixture')); await tick()
  assert.equal(updates.at(-1), false)
  changed(); cleanup()
  const beforeUnmount = updates.length
  pending.shift().resolve([{ enabled: true, available: true }]); await tick()
  assert.equal(updates.length, beforeUnmount)
  assert.equal(unsubscribed, true)
  const grid = fs.readFileSync(path.join(root, 'src/renderer/src/components/translation/TranslationGrid.tsx'), 'utf8')
  assert.match(grid, /hasAvailableSuggestions && <SearchToolbarToggle\s+active=\{showTranslationSuggestions\}/)
  assert.match(grid, /if \(hasAvailableSuggestions\) return[\s\S]*?setShowTranslationSuggestions\(false\)[\s\S]*?setTranslationSuggestions\(\{\}\)/)
  console.log('PASS: empty/disabled/missing/active sources, live changes, stale responses, failures, unmount cleanup and toolbar visibility')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
