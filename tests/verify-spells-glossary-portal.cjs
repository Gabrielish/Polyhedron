const {app,BrowserWindow}=require('electron')
const fs=require('node:fs/promises')
const path=require('node:path')
const {createRequire}=require('node:module')
async function run(){
  const root=path.resolve(__dirname,'..')
  const {build}=createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle=await build({absWorkingDir:root,tsconfig:'config/tsconfig.web.json',bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:root,loader:'jsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {renderSource} from './src/renderer/src/utils/renderSource';
    createRoot(document.getElementById('root')).render(<div id="card" style={{position:'fixed',right:0,bottom:0,width:120,height:65,overflow:'hidden',transform:'translateZ(0)',zIndex:1}}>{renderSource('beasts',{termGlossary:[{id:'test',source:'beasts',translation:'Fiare sălbatice'}],floatingGlossary:true})}</div>);
  `}})
  await app.whenReady()
  const win=new BrowserWindow({show:false,width:600,height:400})
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body><div id="root"></div><div style="position:fixed;right:0;bottom:0;width:120px;height:40px;z-index:100;background:red">Variants</div></body></html>')
  const css=await fs.readFile(path.join(root,'src/renderer/src/assets/main.css'),'utf8')
  await win.webContents.insertCSS(css)
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  await new Promise(r=>setTimeout(r,150))
  const evalJs=s=>win.webContents.executeJavaScript(s,true)
  const check=async(name,s)=>{if(!await evalJs(s))throw new Error(name);console.log('PASS: '+name)}
  await check('no popup before hovering actual term',`!document.querySelector('.floating-glossary-tooltip')`)
  await evalJs(`document.querySelector('.term-glossary-mark').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`)
  await new Promise(r=>setTimeout(r,150))
  await check('popup escapes clipped card and stays within viewport at bottom/right edge',`(()=>{const p=document.querySelector('.floating-glossary-tooltip'),r=p.getBoundingClientRect();return p.parentElement===document.body && r.left>=8 && r.top>=8 && r.right<=innerWidth-7 && r.bottom<=innerHeight-7 && getComputedStyle(p).visibility==='visible'})()`)
  await check('popup is on top and its copy button is accessible',`(()=>{const b=document.querySelector('.floating-glossary-tooltip button'),r=b.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('.floating-glossary-tooltip')!==null && getComputedStyle(document.querySelector('.term-glossary-tooltip')).pointerEvents==='auto'})()`)
  await evalJs(`window.dispatchEvent(new Event('resize'))`)
  await new Promise(r=>setTimeout(r,100))
  await check('resize closes stale popup',`!document.querySelector('.floating-glossary-tooltip')`)
  win.destroy();app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
