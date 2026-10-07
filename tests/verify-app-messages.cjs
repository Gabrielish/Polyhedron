const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createRequire } = require('node:module')

async function run() {
  const root = path.resolve(__dirname, '..'), base = path.join(root, 'src/renderer/src')
  const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';
    import {Toaster,toast} from 'sonner';import {AppMessage} from './src/renderer/src/components/shared/AppMessage';
    window.notify=()=>{for(const tone of ['success','info','warning','error'])toast[tone]('Test '+tone,{id:tone,duration:Infinity,description:'C:/Program Files (x86)/Steam/steamapps/common/Baldurs Gate 3/Data/Localization/English.pak — Existing backup preserved.',action:tone==='success'?{label:'Action',onClick:()=>window.actionCount++}:undefined})};
    createRoot(document.getElementById('root')).render(<><div style={{width:320}}>{['success','info','warning','error'].map(tone=><AppMessage key={tone} tone={tone}>C:/ProgramFiles/Steam/steamapps/common/BaldursGate3/Data/Localization/English.pak — Existing backup preserved.</AppMessage>)}</div><Toaster position="bottom-right" theme="dark" expand visibleToasts={4} closeButton/></>);`
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({ absWorkingDir: root, tsconfig: 'config/tsconfig.web.json', bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: root, loader: 'jsx', contents: fixture } })
  const source = await fs.readFile(path.join(base, 'components/shared/AppMessage.tsx'), 'utf8')
  const cssPath = path.join(base, 'assets/main.css')
  const { compile } = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const compiled = await compile(await fs.readFile(cssPath, 'utf8'), { base: path.dirname(cssPath), onDependency: () => {} })
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 1100, height: 850 })
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body><div id="root"></div></body></html>')
  await win.webContents.insertCSS(compiled.build([...new Set((source + fixture).split(/[\s"'`{}]+/))]))
  const js = code => win.webContents.executeJavaScript(code)
  await js('window.actionCount=0;undefined')
  await js(bundle.outputFiles[0].text)
  const settle = () => new Promise(resolve => setTimeout(resolve, 250))
  await settle(); await js('window.notify();undefined'); await settle()
  for (const accent of ['#a7f175', '#8c52ff']) {
    for (const foreground of ['#000000', '#ffffff']) {
    await js(`document.documentElement.style.setProperty('--poly-accent', '${accent}');document.documentElement.style.setProperty('--poly-accent-foreground','${foreground}');undefined`)
    const results = await js(`Array.from(document.querySelectorAll('.app-message,[data-sonner-toast]')).map(e=>{
      const s=getComputedStyle(e),inline=e.matches('.app-message'),i=inline?e.querySelector('svg'):e.querySelector('[data-icon]');return {inline,tone:e.dataset.messageTone||e.dataset.type,bg:s.backgroundColor,border:s.borderColor,color:s.color,icon:getComputedStyle(i).color,title:inline?null:getComputedStyle(e.querySelector('[data-title]')).color,description:inline?null:getComputedStyle(e.querySelector('[data-description]')).color,shadow:s.boxShadow,overflow:e.scrollWidth>e.clientWidth+1,role:e.getAttribute('role')}
    })`)
    if (results.length !== 8) throw new Error('Missing message or toast: ' + JSON.stringify(results))
    for (const result of results) {
      const accentRgb = accent === '#a7f175' ? 'rgb(167, 241, 117)' : 'rgb(140, 82, 255)'
      const fgRgb = foreground === '#000000' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'
      const icon = !result.inline ? fgRgb : result.tone === 'error' ? 'rgb(248, 113, 113)' : result.tone === 'warning' ? 'rgb(251, 191, 36)' : accentRgb
      if (result.bg !== (result.inline ? 'rgb(16, 16, 16)' : accentRgb) || result.border !== (result.inline ? 'rgb(41, 41, 41)' : accentRgb) || result.color !== (result.inline ? 'rgb(229, 229, 229)' : fgRgb) || result.icon !== icon || (!result.inline && (result.title !== fgRgb || result.description !== fgRgb)) || result.shadow === 'none' || result.overflow) throw new Error('Incorrect message style: ' + JSON.stringify(result))
    }
    }
  }
  if (!await js(`document.querySelector('.app-message[data-message-tone="error"]').getAttribute('role')==='alert'`)) throw new Error('Errors must be announced')
  await js(`document.querySelector('[data-sonner-toast][data-type="success"] [data-button]').click();undefined`)
  await settle()
  if (!await js('window.actionCount===1')) throw new Error('Toast action failed')
  await js(`document.querySelector('[data-sonner-toast][data-type="warning"] [data-close-button]').click();undefined`)
  await new Promise(resolve => setTimeout(resolve, 500))
  if (await js(`!!document.querySelector('[data-sonner-toast][data-type="warning"]')`)) throw new Error('Toast dismissal failed')
  console.log('PASS: all toast types follow accent fill and black/white Button text color; inline notices remain neutral; paths wrap and actions/dismissal still work')
  win.destroy(); app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
