const {app,BrowserWindow}=require('electron')
const fs=require('node:fs/promises'),path=require('node:path')
const {createRequire}=require('node:module')
async function run(){
  const root=path.resolve(__dirname,'..'),base=path.join(root,'src/renderer/src')
  const fixture=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {DragDrop} from './src/renderer/src/components/shared/DragDrop';
    import {FileInputCard} from './src/renderer/src/features/translate/components/FileInputCard';
    function Fixture(){const [drag,setDrag]=useState(false);window.setRefDragging=setDrag;return <div className="app-content-shell"><main><div id="extract"><DragDrop appearance="localization" accept={['zip','pak']} label="Drop your .zip or .pak file here" onFile={p=>window.selected.push(p)}/></div><div id="merge"><FileInputCard showHeader={false} fileName={null} isDragging={drag} onBrowse={async()=>{}} onDragOver={()=>{}} onDragLeave={()=>{}} onDrop={()=>{}} onClear={()=>{}}/></div></main></div>};createRoot(document.getElementById('root')).render(<Fixture/>);`
  const {build}=createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle=await build({absWorkingDir:root,tsconfig:'config/tsconfig.web.json',bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:root,loader:'jsx',contents:fixture},plugins:[{name:'mock-i18n',setup(b){b.onResolve({filter:/useAppTranslation$/},()=>({path:'i18n',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useAppTranslation=()=>({t:key=>key})',loader:'js'}))}}]})
  const sources=await Promise.all(['components/shared/DragDrop.tsx','features/translate/components/FileInputCard.tsx','features/translate/components/styles.ts'].map(p=>fs.readFile(path.join(base,p),'utf8')))
  const cssPath=path.join(base,'assets/main.css'),{compile}=createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const css=await compile(await fs.readFile(cssPath,'utf8'),{base:path.dirname(cssPath),onDependency:()=>{}})
  await app.whenReady();const win=new BrowserWindow({show:false,width:1200,height:700})
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body><div id="root"></div></body></html>')
  await win.webContents.insertCSS(css.build([...new Set([...sources,fixture].flatMap(s=>s.split(/[\s"'`{}]+/)))]))
  await win.webContents.insertCSS('*{transition:none!important}')
  const js=s=>win.webContents.executeJavaScript(s)
  await js(`window.selected=[];window.api={fs:{getPathForFile:f=>'C:/mods/'+f.name,openDialog:async()=>['C:/mods/browse.zip']}};undefined`)
  await js(bundle.outputFiles[0].text)
  const settle=()=>new Promise(r=>setTimeout(r,80));await settle()
  const same=`(()=>{const style=e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.borderColor,s.borderWidth,s.borderStyle,s.borderRadius,s.padding,s.boxShadow]};return JSON.stringify(style(document.querySelector('#extract section')))===JSON.stringify(style(document.querySelector('#merge section'))) && JSON.stringify(style(document.querySelector('#extract button')))===JSON.stringify(style(document.querySelector('#merge button')))})()`
  if(!await js(same))throw new Error('Extract and Merge styles differ')
  await js(`document.querySelector('#extract section').dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true}));window.setRefDragging(true);undefined`);await settle()
  if(!await js(same))throw new Error('Drag-over styles differ')
  await js(`document.querySelector('#extract section').dispatchEvent(new DragEvent('dragleave',{bubbles:true}));window.setRefDragging(false);document.querySelector('#extract button').click();undefined`);await settle()
  if(!await js(`window.selected[0]==='C:/mods/browse.zip'`))throw new Error('Browse callback failed')
  for(const name of ['translation.PAK','invalid.txt']){
    await js(`(()=>{const data=new DataTransfer();data.items.add(new File([''],${JSON.stringify(name)}));document.querySelector('#extract section').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}))})()`);await settle()
  }
  if(!await js(`window.selected.length===2 && window.selected[1]==='C:/mods/translation.PAK' && document.querySelector('#extract').textContent.includes('dragDrop.acceptedFormats')`))throw new Error('Drop acceptance/validation changed')
  console.log('PASS: Extract matches Merge drop zone and Browse button, including themed dragging state; browse and ZIP/PAK validation preserved')
  win.destroy();app.quit()
}
run().catch(e=>{console.error(e);app.exit(1)})
