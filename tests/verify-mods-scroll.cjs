// Exercise the actual scroll effects without building or launching the application.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function effectBody(filename, marker) {
  const source = ts.createSourceFile(filename, fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let body
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes(marker)) {
      body = node.arguments[0].body.getText(source).slice(1, -1)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert(body, `Missing effect: ${marker}`)
  return body
}

const scrollEffect = new Function('selectionCount', 'activeTool', 'suggestionsReady', 'embedded', 'rootRef', 'contentRef', 'requestAnimationFrame', 'cancelAnimationFrame',
  effectBody('src/renderer/src/pages/ModsPage.tsx', 'scrollIntoView'))
const readyEffect = new Function('loading', 'onReady',
  effectBody('src/renderer/src/pages/TranslationSuggestionsPage.tsx', 'onReady'))

for (const embedded of [true, false]) {
  const calls = [], frames = [], cancelled = []
  const root = { scrollIntoView: options => calls.push(['root', options]) }
  const card = { scrollIntoView: options => calls.push(['card', options]) }
  const run = (tool, ready, count = 1) => scrollEffect(count, tool, ready, embedded,
    { current: root }, { current: { lastElementChild: card } },
    callback => { frames.push(callback); return frames.length }, id => cancelled.push(id))
  run('manage', false, 0)
  run('suggestions', false)
  assert.equal(frames.length, 0, 'Do not align before selection or while suggestions load')
  let ready = false
  readyEffect(true, () => { ready = true })
  assert.equal(ready, false)
  readyEffect(false, () => { ready = true })
  assert.equal(ready, true, 'Notify after the populated or error/empty card renders')
  const cleanup = run('suggestions', ready)
  frames.shift()()
  const expected = [embedded ? 'root' : 'card', { behavior: 'smooth', block: 'end', inline: 'nearest' }]
  assert.deepEqual(calls.pop(), expected)
  cleanup()
  assert.deepEqual(cancelled, [1])
  run('extract', false)
  frames.shift()()
  assert.deepEqual(calls.pop(), expected, 'Use exactly the Extract mod alignment')
  run('suggestions', true, 2)
  frames.shift()()
  assert.deepEqual(calls.pop(), expected, 'Reselecting a loaded card still scrolls')
  run('suggestions', false, 3)
  assert.equal(frames.length, 0, 'Returning to suggestions waits for the new load')
}
readyEffect(false, undefined)
console.log('PASS: suggestions wait for loading, match Extract alignment, reselect correctly and cancel pending frames (embedded and standalone)')
