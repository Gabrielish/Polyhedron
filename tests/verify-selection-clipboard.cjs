// Clipboard unit tests: no application build or real clipboard writes.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function evaluate(source, scope = {}) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', ...Object.keys(scope), js)(module, module.exports, ...Object.values(scope))
  return module.exports
}
function callback(file, name) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let expression
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer.getText(tree)
    ts.forEachChild(node, visit)
  }
  visit(tree); assert(expression)
  return expression
}
const { formatSelectionForClipboard } = evaluate(read('src/renderer/src/features/translate/utils/selectionClipboard.ts'))
const rows = [{ uid: 'h-one', source: 'First\n<LSTag Type="Image" Info="SoftWarning"/>', target: 'NOT THE SOURCE' }, { uid: 'h-two', source: 'Second' }]
assert.equal(formatSelectionForClipboard(rows, 'ids'), 'h-one\nh-two')
assert.equal(formatSelectionForClipboard(rows, 'source-ids'), `h-one\n${rows[0].source}\n\nh-two\nSecond`)
assert.equal(formatSelectionForClipboard([], 'ids'), '')
assert.equal(formatSelectionForClipboard([rows[1]], 'source-ids'), 'h-two\nSecond')
let show = false
const toggle = evaluate(`module.exports = ${callback('src/renderer/src/components/translation/TranslationGrid.tsx', 'handleContentIdClick')}`, { setShowId: update => { show = update(show) } })
toggle(); assert.equal(show, true)
toggle(); assert.equal(show, false)
const handler = callback('src/renderer/src/features/translate/components/TranslateLoadedScreen.tsx', 'handleCopySelection')
async function run() {
  const writes = [], notices = []
  let selected = rows, fail = false
  const copy = evaluate(`module.exports = ${handler}`, {
    sessionRef: { current: {} }, materializeSelectedEntries: () => selected, formatSelectionForClipboard,
    navigator: { clipboard: { writeText: async text => { if (fail) throw Error('fixture'); writes.push(text) } } },
    toast: { success: (...args) => notices.push(['success', ...args]), error: (...args) => notices.push(['error', ...args]) }
  })
  await copy('ids'); await copy('source-ids')
  assert.deepEqual(writes, [formatSelectionForClipboard(rows, 'ids'), formatSelectionForClipboard(rows, 'source-ids')])
  assert(notices.every(notice => notice[2].position === 'bottom-right'))
  selected = []; await copy('ids'); assert.equal(writes.length, 2)
  selected = rows; fail = true; await copy('ids'); assert.equal(notices.at(-1)[0], 'error')
  const batch = read('src/renderer/src/components/translation/BatchActionBar.tsx')
  const dropdown = batch.slice(batch.indexOf('<ThemedSelect'), batch.indexOf('/>', batch.indexOf('<ThemedSelect')))
  assert(batch.indexOf('<ThemedSelect') > batch.indexOf("t('batchBar.selectedCount'"))
  assert(batch.indexOf('<ThemedSelect') < batch.indexOf('onClick={onTranslateAI}'))
  assert(!dropdown.includes('menuMinWidth='))
  assert(dropdown.includes('placeholder="Copy selected"'))
  assert(!/tooltip|title=/.test(dropdown))
  const triggerClasses = dropdown.match(/triggerClassName="([^"]+)"/)[1]
  const { twMerge } = require('tailwind-merge')
  const openClasses = twMerge('border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]', triggerClasses)
  assert(openClasses.includes('shadow-none'))
  assert(!openClasses.includes('shadow-['))
  assert(!openClasses.split(' ').includes('border-amber-500'))
  const grid = read('src/renderer/src/components/translation/TranslationGrid.tsx')
  assert(!grid.includes('Copy selected content IDs'))
  console.log('PASS: display-only ID toggle, both copy formats, original source tags/newlines, selected rows, empty selection, errors, right-side feedback and dropdown ordering without tooltip')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
