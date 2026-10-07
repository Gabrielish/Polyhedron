// Unit-test the utility in memory; no application build or output files.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../src/renderer/src/utils/larianTags.ts'), 'utf8')
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const exportsObject = {}
new Function('exports', javascript)(exportsObject)
const { extractLarianTags, wrapSelectionWithTag } = exportsObject
const warning = '<LSTag Type="Image" Info="SoftWarning"/>'
const paired = '<LSTag Type="Spell" Tooltip="Fireball">Fireball</LSTag>'
const expectedPair = { opening: '<LSTag Type="Spell" Tooltip="Fireball">', closing: '</LSTag>' }

assert.deepEqual(extractLarianTags(warning), [{ opening: warning }])
assert.deepEqual(extractLarianTags(`${warning} before ${paired}`), [{ opening: warning }, expectedPair])
assert.deepEqual(extractLarianTags(`${paired} after ${warning}`), [expectedPair, { opening: warning }])
assert.deepEqual(extractLarianTags(`${warning}${warning}`), [{ opening: warning }, { opening: warning }])
for (const standalone of ['<LSTag Type="Image" Info="Warning" />', '<lstag Type="Image" Info="SoftWarning"/>']) {
  assert.deepEqual(extractLarianTags(standalone), [{ opening: standalone }])
}
for (const value of ['', 'Avertisment: atenție!']) {
  for (const cursor of [0, Math.floor(value.length / 2), value.length]) {
    assert.deepEqual(wrapSelectionWithTag(value, { start: cursor, end: cursor }, { opening: warning }), {
      value: value.slice(0, cursor) + warning + value.slice(cursor), cursor: cursor + warning.length
    })
  }
}
assert.equal(wrapSelectionWithTag('abc', { start: 0, end: 2 }, { opening: warning }), null)
assert.equal(wrapSelectionWithTag('abc', { start: 1, end: 1 }, expectedPair), null)
assert.deepEqual(wrapSelectionWithTag('abc', { start: 0, end: 3 }, expectedPair), {
  value: expectedPair.opening + 'abc' + expectedPair.closing,
  cursor: expectedPair.opening.length + 3 + expectedPair.closing.length
})
assert.deepEqual(extractLarianTags('<i>text</i><br><br/><br />'), [
  { opening: '<i>', closing: '</i>' }, { opening: '<br>' }, { opening: '<br/>' }, { opening: '<br />' }
])
console.log('PASS: self-closing LSTags, source order, cursor insertion and existing paired/italic/break tags')
