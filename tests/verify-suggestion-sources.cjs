const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const { createRequire, Module } = require('node:module')
app.disableHardwareAcceleration()

async function run() {
  const root = path.resolve(__dirname, '..')
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'polyhedron-suggestions-test-'))
  app.setPath('userData', temp)
  const bundleRoot = path.join(temp, 'bundle')
  const builtin = path.join(bundleRoot, 'resources/reference/imported-translations')
  fs.mkdirSync(builtin, { recursive: true })
  const xml = text => `<contentList><content contentuid="h-fixture" version="1">${text}</content></contentList>`
  for (const [i, name] of ['traducere1.xml', 'traducere2.xml'].entries()) fs.writeFileSync(path.join(builtin, name), xml(`Suggestion ${i + 1}`))
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  global.__suggestionElectron = { app: { getPath: () => temp, getAppPath: () => bundleRoot }, shell: { trashItem: async file => fs.renameSync(file, `${file}.trashed`) } }
  async function service() {
    const built = await build({ entryPoints: [path.join(root, 'src/main/services/translation-suggestions.service.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'mock-electron', setup(b) {
      b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'module.exports=globalThis.__suggestionElectron' }))
    } }] })
    const loaded = new Module(path.join(root, 'scripts/.suggestions-fixture.cjs'), module)
    loaded.paths = Module._nodeModulePaths(path.join(root, 'scripts'))
    loaded._compile(built.outputFiles[0].text, loaded.id)
    return loaded.exports
  }
  let sources = await service()
  assert.equal(sources.listSuggestionSources().length, 0, 'Fresh installs must not load private bundled/repository XMLs')
  const sourceDir = path.join(temp, 'translation-suggestion-sources')
  fs.writeFileSync(path.join(sourceDir, 'sources.json'), JSON.stringify([
    {id:'builtin-1',name:'traducere1.xml',builtin:'traducere1.xml',enabled:true},
    {id:'builtin-2',name:'traducere2.xml',builtin:'traducere2.xml',enabled:false}
  ]))
  assert.equal(sources.listSuggestionSources().length, 2)
  assert.equal(sources.listSuggestionSources()[1].enabled, false, 'Migration preserves disabled state')
  assert.ok(sources.listSuggestionSources().every(source => !source.builtin && source.available))
  for (const [i,name] of ['traducere1.xml','traducere2.xml'].entries()) {
    assert.deepEqual(fs.readFileSync(path.join(sourceDir, `builtin-${i+1}.xml`)), fs.readFileSync(path.join(builtin,name)))
  }
  sources.setSuggestionSourceEnabled('builtin-2', true)
  assert.equal(sources.loadSuggestions()['h-fixture'].items.length, 2)
  sources.setSuggestionSourceEnabled('builtin-1', false)
  assert.equal(sources.loadSuggestions()['h-fixture'].one, 'Suggestion 2')
  sources = await service()
  assert.equal(sources.listSuggestionSources()[0].enabled, false)
  sources.setSuggestionSourceEnabled('builtin-1', true)
  assert.equal(sources.loadSuggestions()['h-fixture'].items.length, 2)
  const original = path.join(temp, 'replacement.xml')
  fs.writeFileSync(original, xml('Third &amp; new'))
  sources.addSuggestionSources([original])
  let added = sources.listSuggestionSources().find(source => source.name === 'replacement.xml')
  assert.equal(sources.loadSuggestions()['h-fixture'].items[2].text, 'Third & new')
  fs.writeFileSync(original, xml('Original changed'))
  assert.equal(sources.loadSuggestions()['h-fixture'].items[2].text, 'Third & new')
  sources.setSuggestionSourceEnabled(added.id, false)
  assert.equal(sources.loadSuggestions()['h-fixture'].items.length, 2)
  sources.setSuggestionSourceEnabled(added.id, true)
  assert.equal(sources.loadSuggestions()['h-fixture'].items.length, 3)
  await sources.removeSuggestionSource(added.id)
  assert.equal(fs.existsSync(original), true)
  assert.equal(sources.loadSuggestions()['h-fixture'].items.length, 2)
  await sources.removeSuggestionSource('builtin-1')
  sources = await service()
  assert.equal(sources.listSuggestionSources().length, 1)
  assert.equal(fs.existsSync(path.join(builtin, 'traducere1.xml')), true)
  const invalid = path.join(temp, 'invalid.xml')
  fs.writeFileSync(invalid, '<unrelated />')
  assert.throws(() => sources.addSuggestionSources([original, invalid]))
  assert.equal(sources.listSuggestionSources().length, 1)
  sources.setSuggestionSourceEnabled('builtin-2', false)
  assert.equal(Object.keys(sources.loadSuggestions()).length, 0)
  const builder = fs.readFileSync(path.join(root, 'config/electron-builder.yml'), 'utf8')
  assert.ok(builder.includes("'!resources/reference/imported-translations/**'"))
  assert.ok(builder.includes("'!**/translation-suggestion-sources/**'"))
  const workspace = fs.readFileSync(path.join(root, 'src/main/services/workspace.service.ts'), 'utf8')
  assert.ok(!workspace.includes('suggestionSourcesDirectory') && !workspace.includes("'translation-suggestion-sources'"), 'No private reference files in workspace export/import/Drive')
  assert.ok(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('/resources/reference/imported-translations/'))
  console.log('PASS: empty fresh installs, lossless local migration, persistent toggles/removal, XML validation, resources/installer/Git/workspace exclusions')

  await app.whenReady()
  const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{TranslationSuggestionsPage}from'./src/renderer/src/pages/TranslationSuggestionsPage';createRoot(document.getElementById('root')).render(<div className="app-content-shell"><main><TranslationSuggestionsPage/></main></div>);`
  const browser = await build({absWorkingDir:root,tsconfig:'config/tsconfig.web.json',bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:root,loader:'jsx',contents:fixture},plugins:[{name:'i18n',setup(b){b.onResolve({filter:/useAppTranslation$/},()=>({path:'i18n',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useAppTranslation=()=>({t:key=>key})'}))}}]})
  const win = new BrowserWindow({show:false,width:1000,height:550,webPreferences:{backgroundThrottling:false,offscreen:true}})
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body style="background:%23101010"><div id="root"></div></body></html>')
  const js = value => win.webContents.executeJavaScript(value)
  await js(`window.rows=[{id:'1',name:'traducere1.xml',enabled:true,available:true},{id:'2',name:'traducere2.xml',enabled:true,available:true}];window.api={translationSuggestions:{list:async()=>window.rows,add:async()=>{window.rows=[...window.rows,{id:'3',name:'replacement.xml',enabled:true,available:true}];return window.rows},setEnabled:async({id,enabled})=>{window.rows=window.rows.map(row=>row.id===id?{...row,enabled}:row);return window.rows},remove:async({id})=>{window.rows=window.rows.filter(row=>row.id!==id);return window.rows}}};undefined`)
  const cssPath = path.join(root, 'src/renderer/src/assets/main.css')
  const { compile } = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const css = await compile(fs.readFileSync(cssPath,'utf8'),{base:path.dirname(cssPath),onDependency:()=>{}})
  const uiSource = fs.readFileSync(path.join(root,'src/renderer/src/pages/TranslationSuggestionsPage.tsx'),'utf8')
  await win.webContents.insertCSS(css.build([...new Set([uiSource,fixture].flatMap(text=>text.split(/[\s"'`{}]+/)))]))
  await win.webContents.insertCSS(':root{--poly-accent:#A7F175;--poly-accent-rgb:167 241 117;--poly-accent-foreground:#101010;}')
  await js(browser.outputFiles[0].text)
  const settle = () => new Promise(resolve=>setTimeout(resolve,180))
  await settle()
  assert.equal(await js('document.querySelectorAll("input[type=checkbox]").length'),0)
  assert.equal(await js('document.querySelectorAll("button[role=switch]").length'),2)
  assert.equal(await js(`(()=>{
    const section=document.querySelector('section');
    const header=section.querySelector('header');
    const footer=section.querySelector('footer');
    const rows=section.querySelectorAll('button[role=switch]');
    return header.textContent.includes('2 Files') && footer.querySelector('button').textContent.includes('Add files') &&
      footer.getBoundingClientRect().top >= rows[rows.length-1].parentElement.getBoundingClientRect().bottom &&
      parseFloat(getComputedStyle(header).borderBottomWidth)>0;
  })()`),true)
  assert.equal(await js('document.querySelector("button[role=switch]").getAttribute("aria-checked")'), 'true')
  const settings = fs.readFileSync(path.join(root,'src/renderer/src/pages/SettingsPage.tsx'),'utf8')
  for (const token of ['h-5.5 w-9.5','border-amber-500 bg-amber-500','border-neutral-600 bg-neutral-800','top-0.5 left-0.5 h-4 w-4','translate-x-4','transition-transform']) {
    assert.ok(uiSource.includes(token) && settings.includes(token), `Same Settings toggle styling: ${token}`)
  }
  await js('document.querySelector("button[role=switch]").click()');await settle()
  assert.equal(await js('document.body.textContent.includes("Disabled — kept for later")'),true)
  assert.equal(await js('document.querySelector("button[role=switch]").getAttribute("aria-checked")'), 'false')
  await js('document.querySelector("button[role=switch]").click()');await settle()
  await js('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Add files")).click()');await settle()
  assert.equal(await js('document.querySelectorAll("button[role=switch]").length'),3)
  await js(`document.querySelector('button[aria-label="Remove replacement.xml"]').click()`);await settle()
  assert.equal(await js('document.body.textContent.includes("Your original file will not be changed")'),true)
  await js('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Remove").click()');await settle()
  assert.equal(await js('document.querySelectorAll("button[role=switch]").length'),2)
  const screenshot = path.join(temp,'suggestion-sources.png')
  await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
  fs.writeFileSync(screenshot,(await win.webContents.capturePage()).toPNG())
  console.log('PASS: real card renders and supports add, disable/reactivate and confirmed removal')
  console.log('Preview: '+screenshot)
  win.destroy();app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
