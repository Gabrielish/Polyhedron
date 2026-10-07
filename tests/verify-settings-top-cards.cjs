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
    absWorkingDir:root,tsconfig:'config/tsconfig.web.json',bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',
    define:{'process.env.NODE_ENV':'"production"'},
    stdin:{resolveDir:root,loader:'jsx',contents:`
      import React from 'react';import {createRoot} from 'react-dom/client';
      import {SettingsPage} from './src/renderer/src/pages/SettingsPage';
      window.api={app:{getVersion:async()=> '9.8.7'},log:{getPath:async()=>'/test/log'},update:{check:async()=>{},onState:callback=>{window.emitUpdate=callback;return ()=>{}}},cloud:{account:async()=>({connected:true,displayName:'Test account',emailAddress:'test@example.invalid'})}};
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
  // Exercise current feedback styles without rebuilding the application assets.
  const feedbackCss=await fs.readFile(path.join(root,'src/renderer/src/assets/main.css'),'utf8')
  await win.webContents.insertCSS(feedbackCss.slice(feedbackCss.indexOf('/* Inline feedback uses neutral cards;')))
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
  await check('Appearance has no native or custom tooltip triggers',`(()=>{const h=[...document.querySelectorAll('h2')].find(h=>h.textContent==='Appearance'),card=h.parentElement.parentElement;return !card.querySelector('[title],[role="tooltip"],[aria-describedby]') && [...card.querySelectorAll('button')].filter(b=>b.getAttribute('aria-pressed')!==null).every(b=>b.getAttribute('aria-label'))})()`)
  await check('accent-background icon preview uses button text color while inverted preview keeps accent',`(()=>{const paths=document.querySelectorAll('[aria-label="Dock and taskbar icon style"] path');return paths[0].getAttribute('fill')==='#FFFFFF' && paths[1].getAttribute('fill')==='#8C52FF'})()`)
  await check('Preview occupies third column aligned with both circle control rows',`(()=>{
    const b=document.querySelector('.settings-button-preview'),text=document.querySelector('[aria-label="Button text color"]'),icon=document.querySelector('[aria-label="Dock and taskbar icon style"]');
    const x=b.getBoundingClientRect(),t=text.getBoundingClientRect(),i=icon.getBoundingClientRect();
    return b.closest('.settings-icon-controls').children.length===3 && x.left>=i.right && t.right<=i.left && Math.abs((x.top+x.bottom-i.top-i.bottom)/2)<1 && Math.abs((x.top+x.bottom-t.top-t.bottom)/2)<1;
  })()`)
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
  await check('inner account cards share top and bottom edges',`(()=>{const {cloud,updates}=window.cards();const c=cloud.querySelector('.rounded-lg').getBoundingClientRect(),u=updates.querySelector('.rounded-lg').getBoundingClientRect();return Math.abs(c.top-u.top)<0.5 && Math.abs(c.bottom-u.bottom)<0.5})()`)
  await check('introductions have no extra blank height before identity cards',`Object.values(window.cards()).every(card=>{const description=card.querySelector('.settings-top-card-intro p:last-child').getBoundingClientRect(),identity=card.querySelector('.rounded-lg').getBoundingClientRect();return Math.abs(identity.top-description.bottom-20)<0.5})`)
  await check('dates use local 24-hour time, weekday, day/month and year without AM/PM',`(()=>{const {cloud}=window.cards();const values=[...cloud.querySelectorAll('p')].filter(p=>/^Last (upload|download):/.test(p.textContent)).map(p=>p.lastElementChild.textContent);return values.every(value=>/^(?:[01]\\d|2[0-3]):[0-5]\\d, (?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \\d{1,2} [A-Z][a-z]{2,3} 2026$/.test(value))})()`)
  await check('automatic upload has description and dropdown to its right, with dates below',`(()=>{const {cloud}=window.cards();const title=[...cloud.querySelectorAll('p')].find(p=>p.textContent==='Automatic workspace upload');const description=title.nextElementSibling;const t=title.getBoundingClientRect(),d=description.getBoundingClientRect(),s=cloud.querySelector('[aria-haspopup="listbox"]').getBoundingClientRect();const dates=[...cloud.querySelectorAll('p')].find(p=>p.textContent.startsWith('Last upload:')).getBoundingClientRect();return s.left>t.right && description.textContent==='Back up changes to Google Drive.' && d.top>=t.bottom && dates.top>Math.max(d.bottom,s.bottom)})()`)
  await check('Disconnect sits alongside account instead of below',`(()=>{const {cloud}=window.cards();const button=[...cloud.querySelectorAll('button')].find(b=>b.textContent.includes('Disconnect'));const profile=button.parentElement.firstElementChild;const b=button.getBoundingClientRect(),p=profile.getBoundingClientRect();return p.right<=b.left && Math.abs((p.top+p.bottom-b.top-b.bottom)/2)<1})()`)
  await check('card content does not overflow horizontally',`(()=>{const {cloud,updates}=window.cards();return [cloud,updates].every(card=>card.scrollWidth<=card.clientWidth+2) && document.documentElement.scrollWidth<=innerWidth})()`)
  await check('upload and download dates share one row',`(()=>{const {cloud}=window.cards();const rows=[...cloud.querySelectorAll('p')].filter(p=>p.textContent.startsWith('Last upload:')||p.textContent.startsWith('Last download:'));const [u,d]=rows.map(p=>p.getBoundingClientRect());return rows.length===2 && Math.abs(u.top-d.top)<1 && u.right<d.left})()`)
  await check('cloud history has centered 18px circle arrows and hidden accessible labels',`(()=>{
    const cloud=window.cards().cloud;
    return ['Last upload','Last download'].every(title=>{
      const row=cloud.querySelector('[data-cloud-history="'+(title==='Last upload'?'upload':'download')+'"]'),icon=row.querySelector('svg'),label=row.querySelector('.sr-only'),date=row.lastElementChild;
      const i=icon.getBoundingClientRect(),d=date.getBoundingClientRect();
      return label.textContent===title+':' && getComputedStyle(label).position==='absolute' && icon.getAttribute('aria-hidden')==='true' && i.width===18 && i.height===18 && Math.abs((i.top+i.bottom-d.top-d.bottom)/2)<0.5;
    });
  })()`)
  await check('cloud and update actions remain present',`(()=>{const {cloud,updates}=window.cards();return cloud.textContent.includes('Disconnect') && cloud.querySelector('[aria-haspopup="listbox"]') && updates.textContent.includes('Check')})()`)
  for(const kind of ['upload','download']){
    await evaluate(`window.historyHint=window.cards().cloud.querySelector('[data-cloud-history="${kind}"] [tabindex="0"]');window.historyHint.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`)
    await check('custom Last '+kind+' tooltip appears on hover without native title',`(()=>{const hint=document.querySelector('[role="tooltip"]');return hint?.textContent==='Last ${kind}' && getComputedStyle(hint).position==='fixed' && !window.historyHint.closest('[title]')})()`)
    await evaluate(`window.historyHint.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:document.body}))`)
    await check('Last '+kind+' tooltip dismisses on mouse leave',`!document.querySelector('[role="tooltip"]')`)
    await evaluate(`window.historyHint.dispatchEvent(new FocusEvent('focusin',{bubbles:true}))`)
    await check('Last '+kind+' tooltip supports keyboard focus',`document.querySelector('[role="tooltip"]')?.id===window.historyHint.getAttribute('aria-describedby')`)
    await evaluate(`window.historyHint.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));window.historyHint.dispatchEvent(new FocusEvent('focusout',{bubbles:true}))`)
    await check('Last '+kind+' tooltip dismisses on Escape',`!document.querySelector('[role="tooltip"]')`)
  }
  await check('section introductions precede Google and Polyhedron cards',`(()=>{const {cloud,updates}=window.cards();const find=(card,text)=>[...card.querySelectorAll('p')].find(p=>p.textContent===text).getBoundingClientRect();return find(cloud,'Automatic workspace upload').bottom<find(cloud,'Test account').top && find(updates,'Check for updates').bottom<find(updates,'Polyhedron').top})()`)
  await check('application identity card shows runtime version and logo',`(()=>{const {updates}=window.cards();return updates.textContent.includes('Installed version: 9.8.7') && updates.querySelector('svg[viewBox="0 0 12.21 10.26"]')})()`)
  await check('Check for updates sits beside Polyhedron within identity card',`(()=>{const {updates}=window.cards();const button=[...updates.querySelectorAll('button')].find(b=>b.textContent.includes('Check for updates'));const logo=button.parentElement.querySelector('svg[viewBox="0 0 12.21 10.26"]');if(!logo)return false;const b=button.getBoundingClientRect(),l=logo.getBoundingClientRect();return l.right<b.left && Math.abs((l.top+l.bottom-b.top-b.bottom)/2)<1})()`)
  await evaluate(`window.initialFooterCards=Object.fromEntries(Object.entries(window.cards()).map(([key,card])=>[key,{top:card.getBoundingClientRect().top,height:card.getBoundingClientRect().height}]));undefined`)
  for(const status of ['checking','not-available','available','error']){
    await evaluate('window.emitUpdate('+JSON.stringify({status,version:'2.0.0',message:'Background error'})+')')
    await check('background '+status+' does not populate manual update feedback',`window.cards().updates.querySelector('.settings-update-feedback').textContent.trim()===''`)
  }
  await evaluate(`[...window.cards().updates.querySelectorAll('button')].find(button=>button.textContent.includes('Check for updates')).click()`)
  await check('manual button shows checking feedback',`window.cards().updates.querySelector('.settings-update-feedback').textContent.includes('Checking for updates')`)
  for(const [state,text] of [
    [{status:'checking'},'Checking for updates…'],
    [{status:'not-available',version:'1.0.0'},'You are up to date.'],
    [{status:'available',version:'2.0.0'},'Version 2.0.0 is available.'],
    [{status:'downloading',percent:42.4},'Downloading… 42%'],
    [{status:'downloaded',version:'2.0.0'},'Version 2.0.0 is ready to install.'],
    [{status:'error',message:'Test network error'},'Test network error']
  ]){
    await evaluate(`[...window.cards().updates.querySelectorAll('button')].find(button=>button.textContent.includes('Check for updates')).click()`)
    await settle()
    await evaluate('window.emitUpdate('+JSON.stringify(state)+')')
    await check('update status '+state.status+' appears in aligned footer',`(()=>{const {cloud,updates}=window.cards();const status=updates.querySelector('[role="status"]');const dates=[...cloud.querySelectorAll('p')].find(p=>p.textContent.startsWith('Last upload:'));return status.textContent.includes(${JSON.stringify(text)}) && Math.abs(status.getBoundingClientRect().bottom-dates.getBoundingClientRect().bottom)<2})()`)
    await check('actual text baselines and typography match for '+state.status,`(()=>{
      const {cloud,updates}=window.cards();const message=updates.querySelector('[role="status"] .app-message > div');
      const bounds=element=>{const range=document.createRange();range.selectNodeContents(element);return range.getBoundingClientRect()};
      const m=bounds(message),style=getComputedStyle(message);
      return [...cloud.querySelectorAll('p')].filter(p=>/^Last (upload|download):/.test(p.textContent)).every(row=>
        [row.lastElementChild].every(span=>{const r=bounds(span),s=getComputedStyle(span);return Math.abs(r.top-m.top)<0.5 && Math.abs(r.bottom-m.bottom)<0.5 && s.fontSize===style.fontSize && s.lineHeight===style.lineHeight})
      );
    })()`)
    await check('update icon is vertically centered against text for '+state.status,`(()=>{
      const message=window.cards().updates.querySelector('[role="status"] .app-message');
      const icon=message.querySelector('svg').getBoundingClientRect(),text=message.querySelector('div').getBoundingClientRect();
      return Math.abs((icon.top+icon.bottom-text.top-text.bottom)/2)<0.5;
    })()`)
    await check('update icon matches Last download color for '+state.status,`(()=>{
      const {cloud,updates}=window.cards();const label=cloud.querySelector('[data-cloud-history="download"] svg');
      const icon=updates.querySelector('[role="status"] .app-message > svg');
      return getComputedStyle(icon).color===getComputedStyle(label).color;
    })()`)
    if(['checking','not-available'].includes(state.status)){
      await check('update status '+state.status+' does not move or resize either card',`Object.entries(window.cards()).every(([key,card])=>{const r=card.getBoundingClientRect(),initial=window.initialFooterCards[key];return Math.abs(r.top-initial.top)<0.5 && Math.abs(r.height-initial.height)<0.5})`)
    }
  }
  await evaluate(`window.emitUpdate({status:'not-available',version:'1.0.0'})`)
  await check('later background result does not replace a completed manual check',`window.cards().updates.querySelector('.settings-update-feedback').textContent.includes('Test network error')`)
  if(process.argv.includes('--footer-only')){
    win.destroy();app.quit();return
  }
  for(const width of [800,480]){
    win.setContentSize(width,900)
    await check('color settings stack without overflow at '+width+'px',`(()=>{const {accent,text}=window.colorSections();const a=accent.getBoundingClientRect(),t=text.getBoundingClientRect();return Math.abs(a.left-t.left)<1 && a.bottom<t.top && document.documentElement.scrollWidth<=innerWidth})()`)
    await check('cards stack Cloud first at '+width+'px',`(()=>{const {cloud,updates}=window.cards();const c=cloud.getBoundingClientRect(),u=updates.getBoundingClientRect();return Math.abs(c.left-u.left)<1 && c.bottom<u.top && cloud.scrollWidth<=cloud.clientWidth+2 && updates.scrollWidth<=updates.clientWidth+2})()`)
  }
  win.destroy();app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
