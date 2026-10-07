const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createRequire } = require('node:module')

async function run() {
  const root = path.resolve(__dirname, '..'), base = path.join(root, 'src/renderer/src')
  const sources = []
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(file)
      else if (/\.tsx?$/.test(entry.name)) sources.push(await fs.readFile(file, 'utf8'))
    }
  }
  await walk(base)
  const solid = /(?:^|\s)(?:bg-amber-500(?:\/90)?|accent-solid-(?:button|control))(?:\s|$)/
  const classes = [...new Set(sources.flatMap(source => [...source.matchAll(/className="([^"]+)"/g)].map(m => m[1])).filter(cls => solid.test(cls)))]
  const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {FileDown,Loader2,HardDriveDownload} from 'lucide-react';
    import {ExportControls} from './src/renderer/src/features/translate/components/ExportControls';
    import {SessionSaveButton} from './src/renderer/src/features/translate/components/SessionSaveButton';
    const classes=${JSON.stringify(classes)};
    function Samples(){return classes.map((cls,i)=><button key={i} className={cls} data-solid-test><FileDown size={13} strokeWidth={2.5}/><Loader2 size={15} className="animate-spin"/>Action</button>)}
    createRoot(document.getElementById('root')).render(<><div className="app-content-shell"><main><div id="reference"><ExportControls exportFormat="xml" onFormatChange={()=>{}} onExport={async()=>{}} onPakExport={async()=>{}}/><SessionSaveButton session={{entries:[],sourceLang:'en',targetLang:'ro',modName:'test'}}/></div><Samples/></main></div><div className="app-modal-panel"><Samples/></div><button disabled className="bg-amber-500" data-solid-test><FileDown size={13}/></button><div id="card-icon"><HardDriveDownload size={24}/></div><button id="switch" role="switch" className="bg-amber-500"><FileDown size={13}/></button><button id="neutral"><FileDown size={13}/></button></>);`
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({ absWorkingDir: root, tsconfig: 'config/tsconfig.web.json', bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: root, loader: 'jsx', contents: fixture }, plugins: [{ name: 'translation-fixture', setup(builder) {
    builder.onResolve({ filter: /useAppTranslation$/ }, () => ({ path: 'translation', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useAppTranslation=()=>({t:key=>key,currentLanguage:"en"})', loader: 'js' }))
  } }] })
  const { compile } = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const cssPath = path.join(base, 'assets/main.css')
  const compiler = await compile(await fs.readFile(cssPath, 'utf8'), { base: path.dirname(cssPath), onDependency: () => {} })
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 1600, height: 900 })
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body><div id="root"></div></body></html>')
  await win.webContents.insertCSS(compiler.build([...new Set([...sources, fixture].flatMap(source => source.split(/[\s"'`{}]+/)))]))
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  await new Promise(resolve => setTimeout(resolve, 150))
  const result = await win.webContents.executeJavaScript(`(()=>{const size=svg=>{const s=getComputedStyle(svg);return [s.width,s.height,s.strokeWidth,s.flexShrink]};const refs=Array.from(document.querySelectorAll('#reference button[class~="bg-amber-500"] > svg')).map(size);return {refs,samples:Array.from(document.querySelectorAll('[data-solid-test] > svg')).map(size),card:size(document.querySelector('#card-icon svg')),neutral:size(document.querySelector('#neutral svg')),switch:size(document.querySelector('#switch svg'))}})()`)
  const expected = ['24px', '24px', '2px', '0']
  if (result.refs.length !== 3 || result.refs.some(value => JSON.stringify(value) !== JSON.stringify(expected))) throw new Error('PAK/Export/SAVE reference changed: ' + JSON.stringify(result.refs))
  if (result.samples.some(value => JSON.stringify(value) !== JSON.stringify(expected))) throw new Error('Solid action mismatch: ' + JSON.stringify(result.samples))
  if (result.card[0] !== '24px' || result.neutral[0] !== '13px' || result.switch[0] !== '13px') throw new Error('Non-action icons changed')
  const compact = await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-solid-test][class~="h-[34px]"]')).every(button=>{const r=button.getBoundingClientRect();return Math.abs(r.height-34)<0.1 && Array.from(button.querySelectorAll('svg')).every(icon=>{const i=icon.getBoundingClientRect();return i.top>=r.top && i.bottom<=r.bottom})})`)
  if (!compact) throw new Error('Workspace/Inject button height or icon alignment changed')
  console.log('PASS: Workspace/Inject actions keep their original 34px height with centered 24px icons')
  console.log(`PASS: ${result.samples.length} action icons/spinners match actual PAK, Export and SAVE: 24px, stroke 2, no shrinking; card/neutral/switch icons unchanged`)
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
