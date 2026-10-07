// Exercise the real toggle/shortcut callbacks without building the application.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const text = fs.readFileSync(path.join(__dirname, '../src/renderer/src/components/translation/TranslationGrid.tsx'), 'utf8')
const tree = ts.createSourceFile('grid.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let toggle, effect, actions
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'div' && node.openingElement.attributes.getText(tree).includes('translation-replace-actions')) actions = node
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'toggleFindReplace') toggle = node.initializer.arguments[0].getText(tree)
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes('handleFindShortcut')) {
    effect = node.arguments[0].getText(tree)
    assert.equal(node.arguments[1].getText(tree), '[toggleFindReplace]')
  }
  ts.forEachChild(node, visit)
}
visit(tree)
assert(toggle && effect)
assert(actions, 'Replace controls share a bordered toolbar')
assert.match(actions.openingElement.attributes.getText(tree), /rounded-md border border/)
const actionButtons = actions.children.filter(node => ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'SearchToolbarToggle')
assert.equal(actionButtons.length, 4)
assert(actionButtons.every(node => !node.openingElement.attributes.getText(tree).includes('className=')), 'No individual button borders')
function evaluate(expression, names, values) {
  const js = ts.transpileModule(`module.exports = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: null }
  new Function('module', ...names, js)(module, ...values)
  return module.exports
}
let open = false, focused = 0, selected = 0
const listeners = new Map()
const windowMock = {
  setTimeout: callback => callback(),
  addEventListener: (name, callback) => listeners.set(name, callback),
  removeEventListener: (name, callback) => { assert.equal(listeners.get(name), callback); listeners.delete(name) }
}
const input = { current: { focus: () => focused++, select: () => selected++ } }
const toggleCallback = evaluate(toggle, ['window', 'setReplaceOpen', 'searchInputRef'], [windowMock, update => { open = update(open) }, input])
toggleCallback(); assert.equal(open, true)
toggleCallback(); assert.equal(open, false)
assert.equal(focused, 2)
const cleanup = evaluate(effect, ['window', 'toggleFindReplace', 'searchInputRef'], [windowMock, toggleCallback, input])()
const key = (options, expected) => {
  let prevented = false
  listeners.get('keydown')({ key: 'f', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, preventDefault: () => { prevented = true }, ...options })
  assert.equal(prevented, expected)
}
key({ ctrlKey: true }, true); assert.equal(open, true)
key({ metaKey: true }, true); assert.equal(open, false)
key({}, false)
key({ ctrlKey: true, shiftKey: true }, false)
assert.equal(selected, 2)
listeners.get('polyhedron:toggle-find-replace')(); assert.equal(open, true)
cleanup(); assert.equal(listeners.size, 0)
const suggestions = text.indexOf('tooltip="Show translation suggestions"')
const button = text.indexOf('tooltip="Find & replace (Ctrl+F)"')
assert(button > suggestions)
assert(!text.includes('tooltip="Close find and replace"'))
assert.match(text.slice(button - 80, button + 200), /active=\{replaceOpen\}[\s\S]*onClick=\{toggleFindReplace\}/)
console.log('PASS: toolbar toggle, active state, ordering, Ctrl+F, Cmd+F, focus and event cleanup')
