// Test real replacement/selection callbacks in memory, without an app build.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const text = fs.readFileSync(path.join(__dirname, '../src/renderer/src/components/translation/TranslationGrid.tsx'), 'utf8')
const tree = ts.createSourceFile('grid.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let replace, literal, effect
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'replaceMatches') replace = node.initializer.getText(tree)
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'replaceLiteral') literal = node.getText(tree)
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes('selectReplacement')) effect = node.arguments[0].getText(tree)
  ts.forEachChild(node, visit)
}
visit(tree)
assert(replace && literal && effect)
function evaluate(expression, scope) {
  const module = { exports: null }
  const js = ts.transpileModule(`module.exports = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('module', ...Object.keys(scope), js)(module, ...Object.values(scope))
  return module.exports
}
const replaceLiteral = evaluate(literal, {})
for (const [all, variant, replacement] of [[false, 'default', 'bine'], [false, 'female', 'foarte bine'], [false, 'default', ''], [true, 'default', 'bine']]) {
  const entries = [{ rowId: 'row', target: variant === 'default' ? 'Îmi pare RĂU, rău.' : 'Salut.', genderTargets: { female: variant === 'female' ? 'Îmi pare rău.' : '' } }]
  let pending, sticky, displayed
  const scope = {
    replaceFind: 'rău', replaceWith: replacement, replaceLiteral, filteredEntries: entries, pageEntries: entries,
    setReplacementSelection: value => { pending = value }, markSticky: id => { sticky = id },
    setGenderVariants: update => { displayed = update({}) },
    updateEntryTarget: (entry, value) => { entry.target = value },
    session: { updateGenderVariant: (id, gender, value) => { entries[0].genderTargets[gender] = value } },
    onEntryManualEdit: () => {}, setReplaceUndo: () => {}, setReplaceRedo: () => {}, toast: { success: () => {}, info: () => {} }
  }
  evaluate(replace, scope)(all)
  if (all) { assert.equal(pending, null); assert.equal(sticky, undefined); continue }
  assert.equal(sticky, 'row'); assert.equal(displayed.row, variant)
  assert.equal(pending.start, 9); assert.equal(pending.end, 9 + replacement.length)
  const frames = [], scrolled = [], focus = [], ranges = []
  const textarea = { value: 'stale draft', focus: options => focus.push(options), setSelectionRange: (...range) => ranges.push(range) }
  let cleared = false
  const selectionScope = {
    replacementSelection: pending, filteredEntries: entries, pageSize: 250, currentPage: 1,
    viewMode: variant === 'female' ? 'stacked' : 'side',
    sideVirtualizer: { scrollToIndex: (...args) => scrolled.push(['side', ...args]) },
    stackedVirtualizer: { scrollToIndex: (...args) => scrolled.push(['stacked', ...args]) },
    textareaRefs: { current: new Map([['row', textarea]]) },
    setCurrentPage: () => {}, requestAnimationFrame: callback => { frames.push(callback); return frames.length },
    cancelAnimationFrame: () => {}, setReplacementSelection: value => { cleared = value === null }
  }
  evaluate(effect, selectionScope)()
  frames.shift()(); assert.equal(ranges.length, 0)
  textarea.value = pending.after; frames.shift()()
  assert.deepEqual(ranges, [[pending.start, pending.end]])
  assert.deepEqual(focus, [{ preventScroll: true }]); assert(cleared)
  assert.equal(scrolled[0][0], selectionScope.viewMode)
}
// A row moved by sorting must be revealed on its new page before focusing it.
let newPage
evaluate(effect, { replacementSelection: { rowId: 'last' }, filteredEntries: [{ rowId: 'first' }, { rowId: 'last' }], pageSize: 1, currentPage: 1, setCurrentPage: value => { newPage = value } })()
assert.equal(newPage, 2)
console.log('PASS: single replacement range, gender variants, case-insensitive matches, deletion caret, draft settling, both views, page changes and no Replace All focus')
