const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createRequire } = require('node:module')

async function run() {
  const root = path.resolve(__dirname, '..')
  const source = await fs.readFile(path.join(root, 'src/renderer/src/pages/SpellsPage.tsx'), 'utf8')
  const component = source.slice(source.indexOf('function SpellTooltipButton('), source.indexOf('const entryLabel ='))
  if (source.includes('title={entryLabel(spell)}')) throw new Error('Level label still has a native tooltip')
  for (const tooltip of ['Open in Game Data', 'Edit spell']) {
    if (source.includes(`title="${tooltip}"`) || !source.includes(`tooltip="${tooltip}"`))
      throw new Error('Action tooltip not replaced: ' + tooltip)
  }
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({absWorkingDir:root, bundle:true, write:false, platform:'browser',
    format:'iife', jsx:'automatic', define:{'process.env.NODE_ENV':'"production"'},
    stdin:{resolveDir:root,loader:'tsx',contents:`
      import React, {useRef,useId,useState,useEffect,useLayoutEffect} from 'react';
      import {createPortal} from 'react-dom'; import {createRoot} from 'react-dom/client';
      ${component}
      createRoot(document.getElementById('root')).render(
        <article style={{position:'fixed',right:0,top:0,overflow:'hidden',contain:'paint',width:45,height:45}}>
          <SpellTooltipButton tooltip="Open in Game Data" className="action" onClick={()=>{window.clicked=true}}>Open</SpellTooltipButton>
        </article>);
    `}})
  await app.whenReady()
  const win = new BrowserWindow({show:false,width:600,height:400})
  await win.loadURL('data:text/html,<html><body><div id="root"></div></body></html>')
  await win.webContents.insertCSS('button{width:40px;height:30px} [role="tooltip"]{position:fixed;z-index:10000;width:max-content;max-width:224px;padding:8px;background:#131518;color:white;pointer-events:none}')
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  const evalJs = s => win.webContents.executeJavaScript(s,true)
  const settle = () => new Promise(resolve => setTimeout(resolve,100))
  await settle()
  await evalJs(`document.querySelector('button').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`)
  await settle()
  if (!await evalJs(`(()=>{const p=document.querySelector('[role="tooltip"]'),r=p?.getBoundingClientRect();return p?.parentElement===document.body && r.left>=7.5 && r.right<=innerWidth-7.5 && r.top>=7.5 && getComputedStyle(p).visibility==='visible'})()`))
    throw new Error('Tooltip clipped or not visible: ' + JSON.stringify(await evalJs(`(()=>{const p=document.querySelector('[role="tooltip"]');return {html:document.body.innerHTML,rect:p?.getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight}})()`)))
  await evalJs(`document.querySelector('button').click(); window.dispatchEvent(new Event('scroll'))`)
  await settle()
  if (!await evalJs(`window.clicked && !document.querySelector('[role="tooltip"]')`)) throw new Error('Click/scroll behavior failed')
  await evalJs(`document.querySelector('button').dispatchEvent(new FocusEvent('focusin',{bubbles:true}))`)
  await settle()
  if (!await evalJs(`document.querySelector('button').getAttribute('aria-describedby')===document.querySelector('[role="tooltip"]')?.id`)) throw new Error('Keyboard tooltip failed')
  await evalJs(`document.querySelector('button').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
  await settle()
  if (!await evalJs(`!document.querySelector('[role="tooltip"]')`)) throw new Error('Escape did not close tooltip')
  console.log('PASS: custom action tooltips escape card clipping, support focus/Escape, preserve clicks; level label tooltip removed')
  win.destroy()
  app.quit()
}
run().catch(error => {console.error(error);app.exit(1)})
