const {app, BrowserWindow} = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const {createRequire} = require('node:module')
const ts = require('typescript')

async function run() {
  const root = path.resolve(__dirname,'..')
  const base = path.join(root,'src/renderer/src')
  const files = []
  const scan = dir => {for(const e of require('node:fs').readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(p.endsWith('.tsx'))files.push(p)
  }}
  scan(base)
  let panels=0, candidates=[]
  for(const file of files){
    const source=await fs.readFile(file,'utf8')
    candidates.push(...source.split(/[\s"'`{}]+/))
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
    const visit=n=>{
      if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
        const attrs=n.attributes.properties
        const modal=attrs.find(a=>a.name?.text==='aria-modal')
        if(modal?.initializer?.text==='true'){
          const cls=attrs.find(a=>a.name?.text==='className')?.getText(ast)||''
          if(!cls.includes('app-modal-panel'))throw new Error('Unstyled dialog: '+file)
          panels++
        }
      }
      ts.forEachChild(n,visit)
    }
    visit(ast)
  }
  if(panels!==9)throw new Error('Unexpected modal panel count: '+panels)
  console.log('PASS: all 9 dialog panel definitions use the shared modal style (including ModalShell consumers)')
  const {build}=createRequire(require.resolve('vite/package.json'))('esbuild')
  const fixture=`
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {ModalShell} from './src/renderer/src/components/shared/ModalShell';
    import {SettingsSectionCard} from './src/renderer/src/features/settings/SettingsSectionCard';
    import {TermGlossaryModal} from './src/renderer/src/features/translate/components/TermGlossaryModal';
    import {CreatureGuideModal} from './src/renderer/src/features/translate/components/CreatureGuideModal';
    function Fixture(){const [dialog,setDialog]=useState('glossary'),[entries,setEntries]=useState([{id:'1',source:'beast',translation:'bestie'}]);window.setDialog=setDialog;window.fixtureEntries=entries;
      return <><div className="app-content-shell"><main><SettingsSectionCard title="Settings"><input id="settings-input" className="settings-default-input border border-neutral-800"/><button id="settings-neutral" className="border border-neutral-700">Save</button><button id="settings-primary" className="bg-amber-500 border border-amber-500">Save</button></SettingsSectionCard></main></div>
      <TermGlossaryModal open={dialog==='glossary'} sourceLang="en" targetLang="ro" entries={entries} onChange={setEntries} onClose={()=>setDialog('')} onOpenCreatureGuide={()=>setDialog('creature')}/>
      <CreatureGuideModal open={dialog==='creature'} targetLang="ro" termGlossary={entries} onSaveToGlossary={()=>{}} onClose={()=>setDialog('')}/>
      <ModalShell open={dialog==='shell'} title="Shared modal" description="Test" onClose={()=>setDialog('')}><input id="modal-input" className="border border-[#34343e] bg-[#0f1013]"/><button id="modal-neutral" className="border border-[#34343e]">Cancel</button><button id="modal-primary" className="bg-amber-500 border border-amber-500">Save</button><button id="modal-disabled" disabled className="bg-amber-500">Disabled</button></ModalShell></>
    }createRoot(document.getElementById('root')).render(<Fixture/>);
  `
  candidates.push(...fixture.split(/[\s"'`{}]+/))
  const bundle=await build({absWorkingDir:root,tsconfig:'tsconfig.web.json',bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:root,loader:'jsx',contents:fixture}})
  const {compile}=createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const cssPath=path.join(base,'assets/main.css')
  const compiled=await compile(await fs.readFile(cssPath,'utf8'),{base:path.dirname(cssPath),onDependency:()=>{}})
  await app.whenReady()
  const win=new BrowserWindow({show:false,width:1400,height:1000})
  win.webContents.on('console-message',event=>console.log('Renderer:',event.message))
  win.webContents.session.webRequest.onBeforeRequest({urls:['https://*/*']},(_,cb)=>cb({cancel:true}))
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body><div id="root"></div></body></html>')
  await win.webContents.insertCSS(compiled.build([...new Set(candidates)]))
  await win.webContents.insertCSS('button,input{transition:none!important}')
  await win.webContents.executeJavaScript(`Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});undefined`)
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  const evalJs=s=>win.webContents.executeJavaScript(s,true)
  const settle=()=>new Promise(r=>setTimeout(r,150))
  const check=async(name,expr)=>{await settle();if(!await evalJs(expr))throw new Error(name);console.log('PASS: '+name)}
  await evalJs(`window.surface=e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.backgroundImage,s.borderTopColor,s.borderRadius,s.boxShadow,s.backdropFilter]};window.control=e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.borderTopColor,s.boxShadow,s.borderRadius]};undefined`)
  const sameSurface=`JSON.stringify(window.surface(document.querySelector('.app-panel-surface')))===JSON.stringify(window.surface(document.querySelector('.app-modal-panel')))`
  await check('Term Glossary matches Settings panel surface',sameSurface)
  await check('glossary inputs and rows are neutral, not blue',`getComputedStyle(document.querySelector('.app-modal-panel input')).backgroundColor==='rgb(16, 16, 16)' && getComputedStyle(document.querySelector('.app-modal-panel [class~="bg-[#1b1c21]"]')).backgroundColor==='rgb(9, 9, 9)'`)
  await fs.writeFile(path.join(app.getPath('temp'),'polyhedron-unified-glossary-modal.png'),(await win.webContents.capturePage()).toPNG())
  await evalJs(`document.querySelector('[aria-label="Edit beast"]').click()`)
  await check('glossary editing still populates both fields',`document.querySelector('input[placeholder="Source term..."]').value==='beast' && document.querySelector('input[placeholder="Translation..."]').value==='bestie'`)
  await evalJs(`document.querySelector('[aria-label="Delete beast"]').click()`)
  await check('glossary deletion still updates state',`window.fixtureEntries.length===0`)
  await evalJs(`window.setDialog('creature')`)
  await check('Creature Guide shares the same Settings panel surface',sameSurface)
  await evalJs(`window.setDialog('shell')`)
  await check('ModalShell shares the same Settings panel surface',sameSurface)
  await check('modal input matches Settings input background and border',`(()=>{const a=getComputedStyle(document.getElementById('settings-input')),b=getComputedStyle(document.getElementById('modal-input'));return a.backgroundColor===b.backgroundColor && a.borderTopColor===b.borderTopColor})()`)
  win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('DOM.enable');await win.webContents.debugger.sendCommand('CSS.enable')
  const {root:doc}=await win.webContents.debugger.sendCommand('DOM.getDocument')
  for(const id of ['settings-neutral','modal-neutral','settings-primary','modal-primary','modal-disabled']){
    const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:doc.nodeId,selector:'#'+id})
    await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']})
  }
  await check('neutral hover matches Settings',`JSON.stringify(window.control(document.getElementById('settings-neutral')))===JSON.stringify(window.control(document.getElementById('modal-neutral')))`)
  await check('solid accent hover matches Settings and disabled control has no glow',`JSON.stringify(window.control(document.getElementById('settings-primary')))===JSON.stringify(window.control(document.getElementById('modal-primary'))) && getComputedStyle(document.getElementById('modal-disabled')).boxShadow==='none'`)
  for(const theme of ['classic','polyhedron-green','midnight','liquid-glass']){
    await evalJs(`document.documentElement.dataset.theme='${theme}'`)
    await check('shared panel theme: '+theme,sameSurface)
  }
  await evalJs(`document.querySelector('.app-modal-panel [aria-label="Close"]').click()`)
  await check('close button still dismisses the modal',`!document.querySelector('.app-modal-panel')`)
  win.destroy();app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
