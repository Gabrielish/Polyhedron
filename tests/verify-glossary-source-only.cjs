const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

async function run() {
  const root = path.resolve(__dirname, '..')
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const result = await build({
    absWorkingDir: root, tsconfig: 'config/tsconfig.web.json',
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    stdin: { resolveDir: root, loader: 'jsx', contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { HighlightedTextarea } from './src/renderer/src/components/shared/HighlightedTextarea';
      import { renderSource } from './src/renderer/src/utils/renderSource';
      const termGlossary = [{ id: 'test', source: 'Watcher', translation: 'Strajer' }];
      const text = 'Watcher <LSTag Type="Spell" Tooltip="Test">spell</LSTag>  ';
      module.exports = {
        source: renderToStaticMarkup(<div>{renderSource(text, { termGlossary })}</div>),
        target: renderToStaticMarkup(<HighlightedTextarea value={text} highlightQuery="Watcher" searchHighlight="select" />),
        displayTarget: renderToStaticMarkup(<div>{renderSource(text)}</div>)
      };
    ` }
  })
  const fixture = { exports: {} }
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(fixture, fixture.exports, require)
  const { source, target, displayTarget } = fixture.exports
  assert.match(source, /term-glossary-mark/)
  assert.match(source, /term-glossary-tooltip/)
  assert.doesNotMatch(target, /term-glossary-(mark|tooltip)/)
  assert.doesNotMatch(displayTarget, /term-glossary-(mark|tooltip)/)
  assert.match(target, /search-/)
  assert.match(target, /whitespace-selection-highlight/)
  assert.match(target, /LSTag/)
  assert.match(target, /<textarea/)
  const read = file => fs.readFileSync(path.join(root, 'src/renderer/src', file), 'utf8')
  assert.doesNotMatch(read('components/shared/HighlightedTextarea.tsx'), /termGlossary/)
  const spells = read('pages/SpellsPage.tsx')
  assert.match(spells, /renderSourceBase\(translatedDescription\)/)
  assert.match(spells, /renderSourceBase\(\s*variant.translatedDescription/)
  assert.match(spells, /renderSourceBase\(\s*condition.translatedDescription/)
  assert.doesNotMatch(spells, /\{renderSource\(suggestion\)\}/)
  for (const file of ['pages/ReferencePage.tsx', 'pages/DialogueNodesPage.tsx', 'components/translation/TranslationGrid.tsx']) {
    assert.match(read(file), /renderSource\([^]*?termGlossary/)
  }
  console.log('PASS: glossary stays in source, not editable/displayed targets or spell suggestions; search, tags and whitespace remain rendered.')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
