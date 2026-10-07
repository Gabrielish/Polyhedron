const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createRequire } = require('node:module')

async function run() {
  const root = path.resolve(__dirname, '..')
  const base = path.join(root, 'src/renderer/src')
  const source = await fs.readFile(path.join(base, 'features/translate/components/ModSelectionCard.tsx'), 'utf8')
  if ((source.match(/aria-pressed=/g) || []).length !== 4) throw new Error('Both mode selectors need selected-state semantics')
  const start = source.indexOf('function ModeToggle(')
  const end = source.indexOf('function ModOption(', start)
  if (start < 0 || end < 0) throw new Error('Mode selector not found')
  const fixture = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    const cn=(...values)=>values.filter(Boolean).join(' ');
    const useAppTranslation=()=>({t:key=>key.endsWith('.existing')?'Existing':'+ New'});
    ${source.slice(start, end)}
    function Fixture(){const [isNew,setNew]=useState(false);return <div className="app-content-shell"><main><div style={{position:'relative',width:400,height:50,margin:30}}><ModeToggle isNewMod={isNew} shouldHighlightNewMode={false} onExistingMode={()=>setNew(false)} onNewMode={()=>setNew(true)}/></div></main></div>}
    createRoot(document.getElementById('root')).render(<Fixture/>);`
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({ absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: root, loader: 'tsx', contents: fixture } })
  const cssPath = path.join(base, 'assets/main.css')
  const { compile } = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const compiled = await compile(await fs.readFile(cssPath, 'utf8'), { base: path.dirname(cssPath), onDependency: () => {} })
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 500, height: 180 })
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body style="background:%23101010"><div id="root"></div></body></html>')
  await win.webContents.insertCSS(compiled.build([...new Set((source + fixture).split(/[\s"'`{}]+/))]))
  await win.webContents.insertCSS('button{transition:none!important}')
  const js = s => win.webContents.executeJavaScript(s)
  await js(bundle.outputFiles[0].text)
  await new Promise(resolve => setTimeout(resolve, 100))
  await js(`document.documentElement.style.cssText='--poly-accent:#A7F175;--poly-accent-rgb:167 241 117;--color-amber-400:#c1f59e';window.state=()=>Array.from(document.querySelectorAll('button')).map(b=>{const s=getComputedStyle(b);return {selected:b.getAttribute('aria-pressed'),bg:s.backgroundColor,color:s.color,shadow:s.boxShadow,cursor:s.cursor}});undefined`)
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('DOM.enable')
  await win.webContents.debugger.sendCommand('CSS.enable')
  const { root: doc } = await win.webContents.debugger.sendCommand('DOM.getDocument')
  const { nodeIds } = await win.webContents.debugger.sendCommand('DOM.querySelectorAll', { nodeId: doc.nodeId, selector: 'button' })
  for (const accent of ['167 241 117', '140 82 255', '207 55 45']) {
    await js(`document.documentElement.style.setProperty('--poly-accent-rgb',${JSON.stringify(accent)});undefined`)
    const before = await js('window.state()')
    if (before[0].selected !== 'true' || !before[0].bg.includes('0.12') || before[1].bg !== 'rgba(0, 0, 0, 0)') throw new Error('Incorrect selected surface')
    for (const nodeId of nodeIds) await win.webContents.debugger.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] })
    const after = await js('window.state()')
    for (let i = 0; i < 2; i++) {
      if (before[i].bg !== after[i].bg || after[i].shadow === 'none' || after[i].cursor !== 'pointer') throw new Error('Hover must keep surface and add accent glow')
    }
    for (const nodeId of nodeIds) await win.webContents.debugger.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
    console.log('PASS: accent ' + accent + ': selected tint, transparent inactive option, hover glow, hand cursor')
  }
  await js(`document.querySelectorAll('button')[1].click();undefined`)
  await new Promise(resolve => setTimeout(resolve, 50))
  let state = await js('window.state()')
  if (state[0].selected !== 'false' || state[1].selected !== 'true') throw new Error('New mode failed')
  await js(`document.querySelectorAll('button')[0].click();undefined`)
  await new Promise(resolve => setTimeout(resolve, 50))
  state = await js('window.state()')
  if (state[0].selected !== 'true' || state[1].selected !== 'false') throw new Error('Existing mode failed')
  console.log('PASS: switching Existing/New still works')
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
