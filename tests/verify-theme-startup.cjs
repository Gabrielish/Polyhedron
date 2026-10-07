const { app, BrowserWindow, protocol } = require('electron')
const { createRequire } = require('node:module')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

async function run() {
  app.setPath('userData', await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-theme-startup-')))
  const root = path.resolve(__dirname, '..')
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({
    absWorkingDir: root, tsconfig: 'config/tsconfig.web.json', bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { resolveDir: root, loader: 'jsx', contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {initializeTheme,ThemeProvider,useTheme} from './src/renderer/src/context/ThemeContext';
      import {TitleBar} from './src/renderer/src/components/layout/TitleBar';
      function Probe(){window.firstRenderAccent??=useTheme().accent;return <TitleBar/>}
      window.startThemeTest=async({cached,legacy,fail=false})=>{
        localStorage.clear();
        if(cached)localStorage.setItem('polyhedron-accent',cached);
        if(legacy)localStorage.setItem('icosa-accent',legacy);
        window.samples=[];
        window.api={config:{getAll:()=>new Promise((resolve,reject)=>setTimeout(()=>fail?reject(Error('offline')):resolve({theme_accent:'#A7F175',theme_accent_foreground:'black'}),120)),set:async()=>{}},app:{getVersion:async()=>'test'},window:{isMaximized:async()=>false,onMaximizeChange:()=>()=>{}}};
        const sample=()=>{
          const icon=document.querySelector('.titlebar-dragon');
          if(icon)window.samples.push(getComputedStyle(icon).color);
          window.frame=requestAnimationFrame(sample);
        };
        sample();
        await initializeTheme();
        window.beforeMount={accent:document.documentElement.style.getPropertyValue('--poly-accent'),rgb:document.documentElement.style.getPropertyValue('--poly-accent-rgb')};
        createRoot(document.getElementById('root')).render(<ThemeProvider><Probe/></ThemeProvider>);
      };
    ` },
    plugins: [{ name: 'translations', setup(builder) {
      builder.onResolve({ filter: /^@\/i18n\/useAppTranslation$/ }, () => ({ path: 'translation', namespace: 'test' }))
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const useAppTranslation=()=>({t:key=>key})' }))
    } }]
  })
  await app.whenReady()
  protocol.handle('https', () => new Response('<html><head><style>html,body{background:#101010}</style></head><body><div id="root"></div></body></html>', { headers: { 'content-type': 'text/html' } }))
  const cssPath = path.join(root, 'src/renderer/src/assets/main.css')
  const { compile } = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const css = await compile(await fs.readFile(cssPath, 'utf8'), { base: path.dirname(cssPath), onDependency: () => {} })
  const titleSource = await fs.readFile(path.join(root, 'src/renderer/src/components/layout/TitleBar.tsx'), 'utf8')
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } })
  for (const scenario of [
    { cached: '#ED1C24' }, {}, { cached: '#A7F175', fail: true }, { legacy: '#A7F175', fail: true }
  ]) {
    await win.loadURL('https://theme-startup.test')
    await win.webContents.insertCSS(css.build([...new Set(titleSource.split(/[\s"'`{}]+/))]))
    await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
    await win.webContents.executeJavaScript(`window.startThemeTest(${JSON.stringify(scenario)})`)
    await new Promise(resolve => setTimeout(resolve, 250))
    const result = await win.webContents.executeJavaScript(`({first:window.firstRenderAccent,before:window.beforeMount,samples:window.samples,icon:getComputedStyle(document.querySelector('.titlebar-dragon')).color})`)
    if (result.first !== '#A7F175' || result.before.accent !== '#A7F175' || result.before.rgb !== '167 241 117' || result.icon !== 'rgb(167, 241, 117)' || result.samples.some(color => color !== 'rgb(167, 241, 117)')) {
      throw new Error(JSON.stringify({ scenario, result }))
    }
    console.log('PASS: first render and title-bar icon stay green: ' + JSON.stringify(scenario))
  }
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
