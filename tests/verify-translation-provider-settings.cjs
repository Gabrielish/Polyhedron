const {app, BrowserWindow, protocol} = require('electron')
const {createRequire} = require('node:module')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

async function run() {
  app.setPath('userData',await fs.mkdtemp(path.join(os.tmpdir(),'polyhedron-provider-test-')))
  const root=path.resolve(__dirname,'..')
  const {build}=createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle=await build({
    absWorkingDir:root,tsconfig:'config/tsconfig.web.json',bundle:true,write:false,
    platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
    stdin:{resolveDir:root,loader:'jsx',contents:`
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {AiProvidersCard,MachineProvidersCard} from './src/renderer/src/features/settings/AiProvidersCard';
      window.saved=[];
      createRoot(document.getElementById('root')).render(<div className="app-content-shell"><main><AiProvidersCard/><MachineProvidersCard/></main></div>);
    `},
    plugins:[{name:'isolated-provider-config',setup(builder){
      builder.onResolve({filter:/^@\/(hooks\/useAISettings|i18n\/useAppTranslation)$/},args=>({path:args.path,namespace:'test'}))
      builder.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path.includes('useAISettings') ? `
        export const useAISettings=()=>({
          config:{deepl_key:'test-deepl-original',google_key:'test-google-original'},
          provider:'gemini',modelFor:()=>'',keyFor:id=>id==='gemini'?'test-gemini-original':'',
          set:async(key,value)=>{window.saved.push({key,value})}
        });
      ` : `export const useAppTranslation=()=>({t:key=>key});`}))
    }}]
  })
  await app.whenReady()
  protocol.handle('https',()=>new Response('<div id="root"></div>',{headers:{'content-type':'text/html'}}))
  const win=new BrowserWindow({show:false,width:1100,height:850,webPreferences:{backgroundThrottling:false}})
  await win.loadURL('https://provider.test')
  const cssPath=path.join(root,'src/renderer/src/assets/main.css')
  const {compile}=createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const compiler=await compile(await fs.readFile(cssPath,'utf8'),{base:path.dirname(cssPath),onDependency:()=>{}})
  const source=await fs.readFile(path.join(root,'src/renderer/src/features/settings/AiProvidersCard.tsx'),'utf8')
  await win.webContents.insertCSS(compiler.build([...new Set(source.split(/[\s"'`{}]+/))]))
  await win.webContents.insertCSS('*{transition:none!important}')
  await win.webContents.executeJavaScript(`document.documentElement.dataset.theme='liquid-glass';undefined`)
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  const evaluate=source=>win.webContents.executeJavaScript(source,true)
  const settle=ms=>new Promise(resolve=>setTimeout(resolve,ms ?? 60))
  const check=async(name,expression)=>{
    await settle()
    if(!await evaluate(expression))throw new Error(name)
    console.log('PASS: '+name)
  }
  await check('six provider rows and four AI model selectors',`document.querySelectorAll('input[aria-label$="API key"]').length===6 && document.querySelectorAll('[aria-haspopup="listbox"]').length===4`)
  await check('AI and machine providers live in separate cards',`(()=>{const heads=[...document.querySelectorAll('h2')];return heads.length===2 && heads[0].textContent==='providers.title' && heads[1].textContent==='Machine translation' && heads[0].parentElement.parentElement.querySelectorAll('input').length===4 && heads[1].parentElement.parentElement.querySelectorAll('input').length===2})()`)
  await check('stored DeepL, Google and Gemini keys remain separate',`document.querySelector('input[aria-label="DeepL API key"]').value==='test-deepl-original' && document.querySelector('input[aria-label="Google Translate API key"]').value==='test-google-original' && document.querySelector('input[aria-label="Google Gemini API key"]').value==='test-gemini-original'`)
  await check('machine translation rows have badges and no fake AI selectors',`(()=>{const rows=['DeepL','Google Translate'].map(name=>document.querySelector('input[aria-label="'+name+' API key"]').parentElement.parentElement);return rows.every(row=>row.querySelector('span[style]') && !row.querySelector('[aria-haspopup="listbox"]') && row.querySelectorAll('button').length===1)})()`)
  for(const [name,key] of [['DeepL','deepl_key'],['Google Translate','google_key']]) {
    await evaluate(`(()=>{const input=document.querySelector('input[aria-label="${name} API key"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'  test-updated-${key}  ');input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
    await settle(750)
    await check(name+' auto-saves to its original config key',`window.saved.some(item=>item.key==='${key}' && item.value==='test-updated-${key}')`)
    await evaluate(`document.querySelector('input[aria-label="${name} API key"]').parentElement.querySelector('button').click()`)
    await check(name+' key visibility toggles',`document.querySelector('input[aria-label="${name} API key"]').type==='text'`)
    await evaluate(`document.querySelector('input[aria-label="${name} API key"]').parentElement.querySelector('button').click()`)
    await check(name+' key hides again',`document.querySelector('input[aria-label="${name} API key"]').type==='password'`)
  }
  await check('machine key edits do not change the AI provider or Gemini key',`window.saved.every(item=>item.key==='deepl_key'||item.key==='google_key')`)
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('DOM.enable')
  await win.webContents.debugger.sendCommand('CSS.enable')
  const {root:doc}=await win.webContents.debugger.sendCommand('DOM.getDocument')
  const {nodeIds}=await win.webContents.debugger.sendCommand('DOM.querySelectorAll',{nodeId:doc.nodeId,selector:'.provider-api-key-field > input, .provider-api-key-field > button'})
  for(const state of [[],['hover'],['focus'],['focus-visible'],['active']]){
    for(const nodeId of nodeIds)await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:state})
    await check('API fields and visibility icons share one background: '+(state[0]??'rest'),`Array.from(document.querySelectorAll('.provider-api-key-field > input, .provider-api-key-field > button')).every(e=>{const s=getComputedStyle(e);return s.backgroundColor==='rgba(0, 0, 0, 0)' && s.backgroundImage==='none' && s.boxShadow==='none'})`)
  }
  win.destroy();app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
