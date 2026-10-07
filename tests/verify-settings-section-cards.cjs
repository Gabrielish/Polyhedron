const assert = require('node:assert/strict')
const path = require('node:path')
const { createRequire } = require('node:module')

async function run() {
  const root = path.resolve(__dirname, '..')
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const result = await build({
    absWorkingDir: root, tsconfig: 'config/tsconfig.web.json', bundle: true, write: false,
    platform: 'node', format: 'cjs', jsx: 'automatic',
    stdin: { resolveDir: root, loader: 'jsx', contents: `
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import {Sparkles, Layers, BookOpen} from 'lucide-react';
      import {SettingsSectionCard} from './src/renderer/src/features/settings/SettingsSectionCard';
      module.exports = [
        ['AI translation', Sparkles], ['Translation prompt', Layers], ['Similarity search', BookOpen]
      ].map(([title, Icon]) => renderToStaticMarkup(
        <SettingsSectionCard title={title} contentTitle="Content title" subtitle="Section description" icon={<Icon size={18}/>}>
          <button type="button">Existing control</button>
        </SettingsSectionCard>
      ));
    ` }
  })
  const fixture = {exports: {}}
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(fixture, fixture.exports, require)
  for (const html of fixture.exports) {
    const header = html.match(/<div class="border-b[^]*?<\/div>/)?.[0]
    assert.ok(header)
    assert.match(header, /<h2/)
    assert.doesNotMatch(header, /<svg|Section description/)
    assert.ok(html.indexOf('Section description') > html.indexOf(header))
    assert.ok(html.indexOf('Content title') > html.indexOf(header))
    assert.ok(html.indexOf('Content title') < html.indexOf('Section description'))
    assert.ok(html.indexOf('Existing control') > html.indexOf('Section description'))
    assert.match(html, /<svg[^]*?width="18"/)
    assert.doesNotMatch(html, /h-8 w-8|bg-amber-500\/12/)
  }
  console.log('PASS: all three card layouts use title/divider/body and plain 18px icons, preserving content.')
}
run().catch(error => {console.error(error);process.exitCode=1})
