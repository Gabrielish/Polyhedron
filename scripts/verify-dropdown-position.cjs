const { app, BrowserWindow, protocol } = require('electron')
const { createRequire } = require('node:module')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

async function run() {
  app.setPath('userData', await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-dropdown-test-')))
  const root = path.resolve(__dirname, '..')
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({
    absWorkingDir: root, tsconfig: 'tsconfig.web.json', bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { resolveDir: root, loader: 'jsx', contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {ThemedSelect} from './src/renderer/src/components/shared/ThemedSelect';
      const root=createRoot(document.getElementById('root'));
      let key=0;
      window.mountScenario=({top=350,count=2,searchable=false,virtualized=false,left=20})=>{
        root.render(<div key={++key} style={{position:'absolute',top,left,width:160}}>
          <ThemedSelect value="0" onChange={()=>{}} searchable={searchable} virtualized={virtualized}
            options={Array.from({length:count},(_,index)=>({value:String(index),label:'Option '+index}))}/>
        </div>);
      };
    ` },
    plugins:[{name:'test-translation',setup(builder){
      builder.onResolve({filter:/^@\/i18n\/useAppTranslation$/},()=>({path:'translation',namespace:'test'}));
      builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useAppTranslation=()=>({t:key=>key})'}));
    }}]
  })
  await app.whenReady()
  protocol.handle('https',()=>new Response('<div id="root"></div>',{headers:{'content-type':'text/html'}}))
  const win=new BrowserWindow({show:false,width:800,height:600,webPreferences:{backgroundThrottling:false}})
  win.setContentSize(800,600)
  await win.loadURL('https://dropdown.test')
  const assets=path.join(root,'out/renderer/assets')
  const css=(await fs.readdir(assets)).find(name=>name.endsWith('.css'))
  await win.webContents.insertCSS(await fs.readFile(path.join(assets,css),'utf8'))
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  const evaluate=source=>win.webContents.executeJavaScript(source,true)
  const settle=()=>new Promise(resolve=>setTimeout(resolve,100))
  const check=async(name,expression)=>{
    await settle()
    if(!await evaluate(expression)) throw new Error(name+' '+JSON.stringify(await evaluate(`window.geometry()`)))
    console.log('PASS: '+name)
  }
  await evaluate(`window.geometry=()=>{
    const t=document.querySelector('[aria-haspopup="listbox"]').getBoundingClientRect();
    const m=document.querySelector('[role="listbox"]').getBoundingClientRect();
    return {triggerTop:t.top,triggerBottom:t.bottom,top:m.top,bottom:m.bottom,left:m.left,right:m.right,height:m.height,viewport:innerHeight};
  }; undefined`)
  const scenario=async options=>{
    await evaluate('window.mountScenario('+JSON.stringify(options)+')')
    await settle()
    await evaluate(`document.querySelector('[aria-haspopup="listbox"]').click()`)
    await settle()
  }
  const down=`(()=>{const g=window.geometry();return Math.abs(g.top-g.triggerBottom-4)<1 && g.bottom<=g.viewport-3})()`
  const up=`(()=>{const g=window.geometry();return Math.abs(g.triggerTop-g.bottom-4)<1 && g.top>=3})()`
  await scenario({top:350,count:2})
  await check('short menu opens down when less than 240px remains',down)
  await scenario({top:550,count:2})
  await check('short menu opens above with exactly 4px gap',up)
  await scenario({top:20,count:100})
  await check('long menu opens down and scrolls',down)
  await check('long menu has scrolling viewport',`(()=>{const e=document.querySelector('.themed-select-options');return e.scrollHeight>e.clientHeight && e.clientHeight<=240})()`)
  await scenario({top:450,count:100})
  await check('long menu flips above without gap',up)
  await scenario({top:350,count:100,searchable:true})
  await check('searchable menu accounts for header height',up)
  await evaluate(`(()=>{const input=document.querySelector('[role="listbox"] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Option 99');input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  await check('filtered short menu moves down and stays anchored',down)
  await scenario({top:350,count:2,virtualized:true})
  await check('short virtualized menu opens down',down)
  await scenario({top:450,count:100,virtualized:true})
  await check('large virtualized menu flips above and stays anchored',up)
  await scenario({top:350,count:2,left:740})
  await check('right edge stays inside viewport',`window.geometry().right<=innerWidth-3`)
  win.setContentSize(800,420)
  await check('resize flips short menu above',up)
  win.setContentSize(800,600)
  await check('resize restores downward placement',down)
  await scenario({top:500,count:2})
  await check('before scroll opens above',up)
  // Hidden Electron windows may suppress native scroll-event delivery.
  // Move the actual viewport, then explicitly exercise the scroll listener.
  await evaluate(`document.body.style.minHeight='1200px';window.scrollTo(0,200);window.dispatchEvent(new Event('scroll'))`)
  await check('scroll listener repositions dropdown against moved trigger',down)
  win.destroy()
  app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
