const {app,BrowserWindow,protocol}=require('electron')
const {createRequire}=require('node:module')
const fs=require('node:fs/promises')
const path=require('node:path')
const os=require('node:os')

async function run(){
  app.setPath('userData',await fs.mkdtemp(path.join(os.tmpdir(),'polyhedron-settings-layout-')))
  const root=path.resolve(__dirname,'..')
  const {build}=createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle=await build({
    absWorkingDir:root,tsconfig:'tsconfig.web.json',bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',
    define:{'process.env.NODE_ENV':'"production"'},
    stdin:{resolveDir:root,loader:'jsx',contents:`
      import React from 'react';import {createRoot} from 'react-dom/client';
      import {SettingsPage} from './src/renderer/src/pages/SettingsPage';
      window.api={app:{getVersion:async()=> '9.8.7-test'},log:{getPath:async()=>'/test/log'},update:{onState:callback=>{window.emitUpdate=callback;return ()=>{}}},cloud:{account:async()=>({connected:true,displayName:'Test account',emailAddress:'test@example.invalid'})}};
      document.documentElement.dataset.theme='liquid-glass';
      localStorage.setItem('polyhedron.cloud-sync.last-uploaded','2026-10-02T20:50:00Z');
      localStorage.setItem('polyhedron.cloud-sync.last-downloaded','2026-10-02T19:36:00Z');
      createRoot(document.getElementById('root')).render(<div className="app-content-shell"><main><SettingsPage/></main></div>);
    `},
    plugins:[{name:'isolated-settings-state',setup(builder){
      builder.onLoad({filter:/\.svg$/},async args=>({contents:await fs.readFile(args.path,'utf8'),loader:'text'}))
      const mock=/^(?:@\/hooks\/useConfig|@\/context\/ThemeContext|@\/i18n\/useAppTranslation|@\/features\/settings\/(?:AiProvidersCard|PromptSlotsCard|SimilaritySettingsCard)|\.\/MetricsPage)$/
      builder.onResolve({filter:mock},args=>({path:args.path,namespace:'test'}))
      builder.onLoad({filter:/.*/,namespace:'test'},args=>{
        if(args.path.includes('useConfig'))return{contents:'export const useConfig=()=>({config:{},loading:false,set:async()=>{}})'}
        if(args.path.includes('ThemeContext'))return{contents:`export const THEMES=[{id:'liquid-glass',name:'Liquid Glass (Dark)',description:'Dark glass with a custom accent.',swatches:['#8C52FF','#0a0d12']}];export const useTheme=()=>({theme:'liquid-glass',accent:'#8C52FF',accentForeground:'white',appIconStyle:'accent-background',setAppIconStyle:style=>{window.chosenIconStyle=style},accentFavorites:['#8C52FF','#A7F175','#ED1C24',null,null],setTheme:()=>{},setAccent:()=>{},setAccentForeground:()=>{},setAccentFavorites:()=>{}});`}
        if(args.path.includes('useAppTranslation'))return{contents:'export const useAppTranslation=()=>({t:key=>key})'}
        if(args.path.endsWith('/AiProvidersCard'))return{contents:'export const AiProvidersCard=()=>null;export const MachineProvidersCard=()=>null'}
        const name=args.path.split('/').pop();return{contents:'export const '+name+'=()=>null'}
      })
    }}]
  })
  await app.whenReady()
  protocol.handle('https',()=>new Response('<div id="root"></div>',{headers:{'content-type':'text/html'}}))
  const win=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{backgroundThrottling:false}})
  win.webContents.on('console-message',(_event,_level,message)=>console.log('Renderer: '+message))
  await win.loadURL('https://settings.test')
  const assets=path.join(root,'out/renderer/assets')
  await win.webContents.insertCSS(await fs.readFile(path.join(assets,(await fs.readdir(assets)).find(name=>name.endsWith('.css'))),'utf8'))
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  const evaluate=source=>win.webContents.executeJavaScript(source,true)
  const settle=()=>new Promise(resolve=>setTimeout(resolve,150))
  await settle()
  await evaluate(`window.cards=()=>{
    const find=title=>[...document.querySelectorAll('h2')].find(h=>h.textContent===title).parentElement.parentElement;
    return {cloud:find('Cloud sync'),updates:find('Application updates')};
  };undefined`)
  const check=async(name,expression)=>{await settle();if(!await evaluate(expression))throw new Error(name);console.log('PASS: '+name)}
  if(process.argv.includes('--developer-unlock-only')){
    const sourceCss=await fs.readFile(path.join(root,'src/renderer/src/assets/main.css'),'utf8')
    await win.webContents.insertCSS(sourceCss.slice(sourceCss.indexOf('/* Shared page-header rhythm')))
    await check('Settings and AI header typography and icon sizes match',`(()=>{const a=document.getElementById('settings-application-heading'),b=document.getElementById('settings-ai-heading');const same=(x,y,keys)=>keys.every(k=>getComputedStyle(x)[k]===getComputedStyle(y)[k]);return same(a,b,['fontSize','fontWeight','lineHeight']) && same(a.nextElementSibling,b.nextElementSibling,['fontSize','lineHeight']) && same(a.parentElement.previousElementSibling,b.parentElement.previousElementSibling,['width','height'])})()`)
    const hasLogs=`[...document.querySelectorAll('h2')].some(h=>h.textContent==='sections.debugLogs')`
    await check('Divine tools card removed and logs initially hidden',`!(${hasLogs}) && !document.querySelector('#setting-divine_path') && ![...document.querySelectorAll('h2')].some(h=>h.textContent==='sections.tools')`)
    await evaluate(`for(let i=0;i<9;i++)document.querySelector('.settings-button-preview').click()`)
    await check('nine preview clicks do not reveal logs',`!(${hasLogs})`)
    await evaluate(`document.querySelector('.settings-button-preview').click()`)
    await check('tenth click reveals logs with all three actions',`(${hasLogs}) && [...document.querySelectorAll('button')].filter(b=>['actions.open','actions.copyPath','actions.clear'].includes(b.textContent.trim())).length===3`)
    await check('Debug logs sits immediately after Interface in application section',`(()=>{const h=[...document.querySelectorAll('h2')].find(h=>h.textContent==='sections.debugLogs'),card=h.parentElement.parentElement;return card.previousElementSibling.querySelector('h2').textContent==='sections.interface' && card.closest('section').getAttribute('aria-labelledby')==='settings-application-heading'})()`)
    await evaluate(`document.querySelector('.settings-button-preview').click()`)
    await check('further clicks leave developer logs visible',hasLogs)
    win.destroy();app.quit();return
  }
  await evaluate(`window.colorSections=()=>{const accent=document.querySelector('label[for="accent-color"]').parentElement;const text=[...document.querySelectorAll('p')].find(p=>p.textContent==='Button text color').parentElement;return {accent,text}};undefined`)
  await check('accent and button text color occupy two columns on wide windows',`(()=>{const {accent,text}=window.colorSections();const a=accent.getBoundingClientRect(),t=text.getBoundingClientRect();return a.right<t.left && Math.abs(a.top-t.top)<1})()`)
  await check('accent favorites stay alongside the color inputs',`(()=>{const input=document.getElementById('accent-color').getBoundingClientRect(),favorites=document.querySelector('[aria-label="Favorite accent colors"]').getBoundingClientRect();return favorites.left>input.right && input.top<favorites.bottom && favorites.top<input.bottom})()`)
  await check('icon styles share the text color row and show two dragon previews',`(()=>{const text=[...document.querySelectorAll('p')].find(p=>p.textContent==='Button text color'),icon=[...document.querySelectorAll('p')].find(p=>p.textContent==='App icon');const t=text.getBoundingClientRect(),i=icon.getBoundingClientRect();return t.right<i.left && Math.abs(t.top-i.top)<1 && document.querySelectorAll('[aria-label="Dock and taskbar icon style"] button svg path').length===2})()`)
  await evaluate(`document.querySelectorAll('[aria-label="Dock and taskbar icon style"] button')[1].click()`)
  await check('inverted icon control selects accent dragon',`window.chosenIconStyle==='accent-dragon'`)
  await check('accent-background icon preview uses button text color while inverted preview keeps accent',`(()=>{const paths=document.querySelectorAll('[aria-label="Dock and taskbar icon style"] path');return paths[0].getAttribute('fill')==='#FFFFFF' && paths[1].getAttribute('fill')==='#8C52FF'})()`)
  await check('Preview sits to the right of the Theme and accent introduction',`(()=>{const b=document.querySelector('.settings-button-preview'),p=[...b.parentElement.querySelectorAll('p')].find(p=>p.textContent==='Theme and accent');if(!p)return false;const x=b.getBoundingClientRect(),y=p.parentElement.getBoundingClientRect();return x.left>=y.right && Math.abs((x.top+x.bottom-y.top-y.bottom)/2)<1})()`)
  const preview=path.join(app.getPath('userData'),'appearance.png')
  await fs.writeFile(preview,(await win.webContents.capturePage()).toPNG())
  console.log('Appearance preview: '+preview)
  if(process.argv.includes('--appearance-only')){
    for(const width of [900,480]){
      win.setContentSize(width,900)
      await check('appearance does not overflow at '+width+'px',`document.documentElement.scrollWidth<=innerWidth`)
    }
    win.destroy();app.quit();return
  }
  await check('Cloud left, updates right, aligned top and equal heights',`(()=>{const {cloud,updates}=window.cards();const c=cloud.getBoundingClientRect(),u=updates.getBoundingClientRect();return c.left<u.left && Math.abs(c.top-u.top)<1 && Math.abs(u.height-c.height)<1 && c.right<u.left})()`)
  await check('automatic upload has description and dropdown to its right, with dates below',`(()=>{const {cloud}=window.cards();const title=[...cloud.querySelectorAll('p')].find(p=>p.textContent==='Automatic workspace upload');const description=title.nextElementSibling;const t=title.getBoundingClientRect(),d=description.getBoundingClientRect(),s=cloud.querySelector('[aria-haspopup="listbox"]').getBoundingClientRect();const dates=[...cloud.querySelectorAll('p')].find(p=>p.textContent.startsWith('Last upload:')).getBoundingClientRect();return s.left>t.right && description.textContent==='Back up changes to Google Drive.' && d.top>=t.bottom && dates.top>Math.max(d.bottom,s.bottom)})()`)
  await check('Disconnect sits alongside account instead of below',`(()=>{const {cloud}=window.cards();const button=[...cloud.querySelectorAll('button')].find(b=>b.textContent.includes('Disconnect'));const profile=button.parentElement.firstElementChild;const b=button.getBoundingClientRect(),p=profile.getBoundingClientRect();return p.right<=b.left && Math.abs((p.top+p.bottom-b.top-b.bottom)/2)<1})()`)
  await check('card content does not overflow horizontally',`(()=>{const {cloud,updates}=window.cards();return [cloud,updates].every(card=>card.scrollWidth<=card.clientWidth+2) && document.documentElement.scrollWidth<=innerWidth})()`)
  await check('upload and download dates share one row',`(()=>{const {cloud}=window.cards();const rows=[...cloud.querySelectorAll('p')].filter(p=>p.textContent.startsWith('Last upload:')||p.textContent.startsWith('Last download:'));const [u,d]=rows.map(p=>p.getBoundingClientRect());return rows.length===2 && Math.abs(u.top-d.top)<1 && u.right<d.left})()`)
  await check('cloud and update actions remain present',`(()=>{const {cloud,updates}=window.cards();return cloud.textContent.includes('Disconnect') && cloud.querySelector('[aria-haspopup="listbox"]') && updates.textContent.includes('Check')})()`)
  await check('section introductions precede Google and Polyhedron cards',`(()=>{const {cloud,updates}=window.cards();const find=(card,text)=>[...card.querySelectorAll('p')].find(p=>p.textContent===text).getBoundingClientRect();return find(cloud,'Automatic workspace upload').bottom<find(cloud,'Test account').top && find(updates,'Check for updates').bottom<find(updates,'Polyhedron').top})()`)
  await check('application identity card shows runtime version and logo',`(()=>{const {updates}=window.cards();return updates.textContent.includes('Installed version: 9.8.7-test') && updates.querySelector('svg[viewBox="0 0 12.21 10.26"]')})()`)
  await check('Check for updates sits beside Polyhedron within identity card',`(()=>{const {updates}=window.cards();const button=[...updates.querySelectorAll('button')].find(b=>b.textContent.includes('Check for updates'));const logo=button.parentElement.querySelector('svg[viewBox="0 0 12.21 10.26"]');if(!logo)return false;const b=button.getBoundingClientRect(),l=logo.getBoundingClientRect();return l.right<b.left && Math.abs((l.top+l.bottom-b.top-b.bottom)/2)<1})()`)
  for(const [state,text] of [
    [{status:'checking'},'Checking for updates…'],
    [{status:'not-available',version:'1.0.0'},'You are up to date.'],
    [{status:'available',version:'2.0.0'},'Version 2.0.0 is available.'],
    [{status:'downloading',percent:42.4},'Downloading… 42%'],
    [{status:'downloaded',version:'2.0.0'},'Version 2.0.0 is ready to install.'],
    [{status:'error',message:'Test network error'},'Test network error']
  ]){
    await evaluate('window.emitUpdate('+JSON.stringify(state)+')')
    await check('update status '+state.status+' appears in aligned footer',`(()=>{const {cloud,updates}=window.cards();const status=updates.querySelector('[role="status"]');const dates=[...cloud.querySelectorAll('p')].find(p=>p.textContent.startsWith('Last upload:'));return status.textContent.includes(${JSON.stringify(text)}) && Math.abs(status.getBoundingClientRect().bottom-dates.getBoundingClientRect().bottom)<2})()`)
  }
  for(const width of [800,480]){
    win.setContentSize(width,900)
    await check('color settings stack without overflow at '+width+'px',`(()=>{const {accent,text}=window.colorSections();const a=accent.getBoundingClientRect(),t=text.getBoundingClientRect();return Math.abs(a.left-t.left)<1 && a.bottom<t.top && document.documentElement.scrollWidth<=innerWidth})()`)
    await check('cards stack Cloud first at '+width+'px',`(()=>{const {cloud,updates}=window.cards();const c=cloud.getBoundingClientRect(),u=updates.getBoundingClientRect();return Math.abs(c.left-u.left)<1 && c.bottom<u.top && cloud.scrollWidth<=cloud.clientWidth+2 && updates.scrollWidth<=updates.clientWidth+2})()`)
  }
  win.destroy();app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
