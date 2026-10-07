const {app, BrowserWindow} = require('electron')
const {createRequire} = require('node:module')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const root = path.resolve(__dirname, '..')
  const {build} = createRequire(require.resolve('vite/package.json'))('esbuild')
  const spells = [
    {id:'acid',name:'Acid Splash',description:'Throw acid.',category:'Spell',level:'0',conditions:['Burning']},
    {id:'bone',name:'Bone Chill',description:'Chill a target.',category:'Spell',level:'0'},
    {id:'blade',name:'Blade Ward',description:'Protect yourself.',category:'Spell',level:'0'},
    {id:'light',name:'Light',description:'Light an object.',category:'Spell',level:'0'},
    {id:'variant',name:'Acid Splash: Strong',description:'Throw more acid.',category:'Spell',level:'0'},
    {id:'BURNING',name:'Burning',description:'Taking fire damage.',category:'Status'}
  ]
  const entries = spells.flatMap((spell,i)=>[spell.name,spell.description].map((source,j)=>
    ({rowId:i*2+j,uid:'uid-'+i+'-'+j,source,target:'RO '+source,reviewStatus:'verified'})))
  const mocks = {
    '@/context/TranslationSession': `import {useState} from 'react';export function useTranslationSession(){const [entries,setEntries]=useState(${JSON.stringify(entries)});window.testEntries=entries;return {phase:'loaded',entries,sourceLang:'en',targetLang:'ro',storedPath:'fixture',updateEntry:(id,target)=>setEntries(prev=>prev.map(e=>e.rowId===id?{...e,target}:e)),setReviewStatus:()=>{}}}`,
    '@/data/gameReference': `const entries=${JSON.stringify(spells)};export const getReferenceCatalog=category=>category?entries.filter(e=>e.category===category):entries;`,
    '@/data/spells.json': 'export default []',
    '@/hooks/useRetainedMemo': `import {useMemo} from 'react';export const useRetainedMemo=(key,fn,deps)=>useMemo(fn,deps)`,
    'react-router-dom': 'export const useNavigate=()=>()=>{}',
    '@/i18n/useAppTranslation': 'export const useAppTranslation=()=>({t:key=>key})',
    '@/features/translate/components/SessionSaveButton': 'export const SessionSaveButton=()=>null',
    '@/features/translate/components/TermGlossaryModal': 'export const TermGlossaryModal=()=>null',
    '@/components/shared/StyledWebview': `import React from 'react';export const StyledWebview=props=><div data-test-wiki={props.src} style={{height:'100%'}}>Wiki</div>`,
    '@/components/shared/HighlightedTextarea': `import React,{useState} from 'react';export function HighlightedTextarea({value,onBlur,containerClassName,className}){const [draft,setDraft]=useState(value);return <div className={containerClassName}><textarea className={className} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={onBlur}/></div>}`
  }
  const bundle = await build({absWorkingDir:root,tsconfig:'config/tsconfig.web.json',bundle:true,write:false,
    platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
    stdin:{resolveDir:root,loader:'jsx',contents:`
      import React from 'react';import {createRoot} from 'react-dom/client';
      import {SpellsPage} from './src/renderer/src/pages/SpellsPage';
      window.fetch=async()=>({ok:true,text:async()=>'',json:async()=>({query:{pages:{}}})});
      window.api={translationSuggestions:{load:async()=>({})}};
      createRoot(document.getElementById('root')).render(<div className="app-content-shell h-screen"><main className="h-full"><SpellsPage/></main></div>);
    `},plugins:[{name:'isolated-spells-state',setup(builder){
      builder.onResolve({filter:/.*/},args=>args.path in mocks?{path:args.path,namespace:'fixture'}:undefined)
      builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'jsx',resolveDir:root}))
    }}]})
  const {compile} = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const cssPath = path.join(root,'src/renderer/src/assets/main.css')
  const source = await fs.readFile(path.join(root,'src/renderer/src/pages/SpellsPage.tsx'),'utf8')
  const compiler = await compile(await fs.readFile(cssPath,'utf8'),{base:path.dirname(cssPath),onDependency:()=>{}})
  const css = compiler.build([...new Set(source.split(/[\s"'`{}]+/).concat(['h-screen','h-full']))])
  await app.whenReady()
  const win = new BrowserWindow({show:false,width:2000,height:1000})
  win.webContents.on('console-message',event=>console.log('Renderer:',event.message))
  win.webContents.session.webRequest.onBeforeRequest({urls:['https://bg3.wiki/*']},(_,cb)=>cb({cancel:true}))
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body><div id="root"></div></body></html>')
  await win.webContents.insertCSS(css)
  await win.webContents.executeJavaScript(`Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});undefined`)
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  const evalJs = source => win.webContents.executeJavaScript(source,true)
  const settle = () => new Promise(resolve=>setTimeout(resolve,250))
  const check = async(name,expr) => {await settle();if(!await evalJs(expr))throw new Error(name);console.log('PASS: '+name)}
  await check('normal catalog has four columns and no editor',`getComputedStyle(document.querySelector('.spells-card-grid')).gridTemplateColumns.split(' ').length===4 && !document.querySelector('.spells-editor-slot')`)
  await evalJs(`document.querySelector('[aria-label="Edit spell"]').click()`)
  await check('edit uses inline right panel and two card columns, no modal or automatic webview',`(()=>{const grid=document.querySelector('.spells-card-grid'),panel=document.querySelector('.spells-edit-panel');return getComputedStyle(grid).gridTemplateColumns.split(' ').length===2 && panel.closest('aside') && !document.querySelector('[aria-modal="true"]') && !document.querySelector('[data-test-wiki]') && panel.getBoundingClientRect().left>grid.getBoundingClientRect().right})()`)
  await check('editor retains variant and condition fields',`document.querySelector('.spells-edit-panel').textContent.includes('Acid Splash: Strong') && document.querySelector('.spells-edit-panel').textContent.includes('Burning')`)
  win.setSize(1280,800)
  await check('narrow desktop still has two card columns and an independently scrollable right panel',`(()=>{const grid=document.querySelector('.spells-card-grid'),panel=document.querySelector('.spells-edit-panel'),scroller=panel.querySelector('.polyhedron-scroll');return getComputedStyle(grid).gridTemplateColumns.split(' ').length===2 && panel.getBoundingClientRect().left>=grid.getBoundingClientRect().right && panel.scrollWidth<=panel.clientWidth+1 && scroller.scrollHeight>scroller.clientHeight && panel.getBoundingClientRect().bottom<=innerHeight+1})()`)
  await check('editor can scroll its last section above the floating navigation',`(()=>{const scroller=document.querySelector('.spells-edit-panel .polyhedron-scroll');scroller.scrollTop=scroller.scrollHeight;const gap=scroller.getBoundingClientRect().bottom-scroller.lastElementChild.getBoundingClientRect().bottom;return parseFloat(getComputedStyle(scroller).paddingBottom)>=112 && gap>=111})()`)
  win.setSize(2000,1000)
  await settle()
  await fs.writeFile(path.join(app.getPath('temp'),'polyhedron-spells-inline-editor.png'),(await win.webContents.capturePage()).toPNG())
  await evalJs(`const input=document.querySelector('.spells-edit-panel input');input.value='Stropire cu acid';input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));undefined`)
  await check('editing still writes the matching session entry',`window.testEntries.find(e=>e.source==='Acid Splash').target==='Stropire cu acid'`)
  await evalJs(`Array.from(document.querySelectorAll('.spells-edit-panel button')).find(b=>b.textContent==='Wiki').click()`)
  await check('Wiki button opens the selected spell within the same panel',`document.querySelector('[data-test-wiki]').dataset.testWiki==='https://bg3.wiki/wiki/Acid_Splash' && !document.querySelector('.spells-edit-panel input')`)
  await evalJs(`Array.from(document.querySelectorAll('.spells-edit-panel button')).find(b=>b.textContent==='Editor').click()`)
  await check('return from Wiki restores saved editor value',`document.querySelector('.spells-edit-panel input').value==='Stropire cu acid' && !document.querySelector('[data-test-wiki]')`)
  await evalJs(`Array.from(document.querySelectorAll('.spell-card')).find(c=>c.querySelector('h3').textContent==='Bone Chill').querySelector('[aria-label="Edit spell"]').click()`)
  await check('selecting another card updates the editor without stale input values',`document.querySelector('.spells-edit-panel h2').textContent==='Bone Chill' && document.querySelector('.spells-edit-panel input').value==='RO Bone Chill'`)
  await evalJs(`document.querySelector('[aria-label="Close spell editor"]').click()`)
  await check('X closes panel and restores four columns',`!document.querySelector('.spells-editor-slot') && getComputedStyle(document.querySelector('.spells-card-grid')).gridTemplateColumns.split(' ').length===4`)
  await evalJs(`document.querySelector('[aria-label="Edit spell"]').click();`)
  await settle()
  await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`)
  await check('Escape also closes the inline editor',`!document.querySelector('.spells-editor-slot')`)
  win.destroy()
  app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
