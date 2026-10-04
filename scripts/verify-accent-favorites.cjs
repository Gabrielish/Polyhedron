const { app, BrowserWindow, protocol } = require('electron')
const { createRequire } = require('node:module')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

async function run() {
  app.setPath('userData', await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-accent-test-')))
  const root = path.resolve(__dirname, '..')
  const settings = await fs.readFile(path.join(root, 'src/renderer/src/pages/SettingsPage.tsx'), 'utf8')
  const dropdown = settings.match(/<ThemedSelect\s+value=\{accentForeground\}[\s\S]*?\/>/)?.[0]
  if (!dropdown) throw new Error('Button text color must use ThemedSelect')
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({
    absWorkingDir: root, tsconfig: 'tsconfig.web.json', bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { resolveDir: root, loader: 'jsx', contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ThemeProvider, useTheme } from './src/renderer/src/context/ThemeContext';
      import { AccentColorControl } from './src/renderer/src/features/settings/AccentColorControl';
      import { ThemedSelect } from './src/renderer/src/components/shared/ThemedSelect';
      function TextColor() {
        const {accentForeground, setAccentForeground}=useTheme();
        return <div style={{width:160}}>${dropdown}</div>;
      }
      window.savedConfig = {};
      window.api = { config: {
        getAll: async () => ({...window.savedConfig}),
        set: async ({key, value}) => { window.savedConfig[key] = value }
      }};
      const root = createRoot(document.getElementById('root'));
      window.mount = key => root.render(<ThemeProvider key={key}><AccentColorControl /><TextColor /></ThemeProvider>);
      window.mount(0);
    ` },
    plugins: [{name:'isolated-translation', setup(builder) {
      builder.onResolve({filter:/^@\/i18n\/useAppTranslation$/}, ()=>({path:'translation',namespace:'test'}))
      builder.onLoad({filter:/.*/,namespace:'test'}, ()=>({contents:'export const useAppTranslation=()=>({t:key=>key})'}))
    }}]
  })
  await app.whenReady()
  protocol.handle('https', () => new Response('<div id="root"></div>', { headers: { 'content-type': 'text/html' } }))
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } })
  await win.loadURL('https://accent.test')
  const assets = path.join(root, 'out/renderer/assets')
  const cssFile = (await fs.readdir(assets)).find(name => name.endsWith('.css'))
  if (!cssFile) throw new Error('Build the renderer before running this test')
  await win.webContents.insertCSS(await fs.readFile(path.join(assets, cssFile), 'utf8'))
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  const evaluate = source => win.webContents.executeJavaScript(source, true)
  const settle = () => new Promise(resolve => setTimeout(resolve, 60))
  const check = async (name, expression) => {
    await settle()
    if (!await evaluate(expression)) throw new Error(name)
    console.log('PASS: ' + name)
  }
  const edit = async value => {
    await evaluate(`(() => {
      const input = document.getElementById('accent-color');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', {bubbles:true}));
    })()`)
    await settle()
  }
  const click = async index => {
    await evaluate(`document.querySelectorAll('[aria-label="Favorite accent colors"] button')[${index}].click()`)
    await settle()
  }
  await check('five slots and three exact defaults', `(() => {
    const b = [...document.querySelectorAll('[aria-label="Favorite accent colors"] button')];
    return b.length===5 && b[0].ariaLabel.includes('#8C52FF') && b[1].ariaLabel.includes('#A7F175') && b[2].ariaLabel.includes('#ED1C24') && b[3].ariaLabel.includes('Save current');
  })()`)
  await check('Use red removed', `!document.body.textContent.includes('Use red')`)
  await check('redundant Reset default removed', `!document.body.textContent.includes('Reset default')`)
  await check('favorites share the row with HEX and picker', `(() => {
    const nodes = [document.getElementById('accent-color'), document.querySelector('input[type="color"]'),
      ...document.querySelectorAll('[aria-label="Favorite accent colors"] button')];
    const centers=nodes.map(node=>{const r=node.getBoundingClientRect();return r.top+r.height/2});
    return Math.max(...centers)-Math.min(...centers)<2;
  })()`)
  await check('swatches are circular, spaced and retain their exact colors', `(() => {
    const b=[...document.querySelectorAll('[aria-label="Favorite accent colors"] button')];
    return b.every((item,index)=>{
      const r=item.getBoundingClientRect();
      return r.width===32 && r.height===32 && getComputedStyle(item).borderRadius==='50%' && (index===0 || r.left>b[index-1].getBoundingClientRect().right);
    }) && getComputedStyle(b[0]).backgroundColor==='rgb(140, 82, 255)' &&
      getComputedStyle(b[1]).backgroundColor==='rgb(167, 241, 117)' &&
      getComputedStyle(b[2]).backgroundColor==='rgb(237, 28, 36)';
  })()`)
  await edit('#123456')
  await click(3)
  await check('empty slot saves current color', `JSON.parse(localStorage.getItem('polyhedron-accent-favorites'))[3]==='#123456'`)
  await edit('#654321')
  await check('editing selected slot updates only that slot', `JSON.stringify(JSON.parse(localStorage.getItem('polyhedron-accent-favorites')))===JSON.stringify(['#8C52FF','#A7F175','#ED1C24','#654321',null])`)
  await click(4)
  await click(3)
  await edit('#ABCDEF')
  await check('full palette replaces selected custom slot', `JSON.stringify(JSON.parse(localStorage.getItem('polyhedron-accent-favorites')))===JSON.stringify(['#8C52FF','#A7F175','#ED1C24','#ABCDEF','#654321'])`)
  await check('selected color applied to theme and durable config', `document.documentElement.style.getPropertyValue('--poly-accent')==='#ABCDEF' && JSON.parse(window.savedConfig.theme_accent_favorites)[3]==='#ABCDEF'`)
  await edit('#BAD')
  await check('invalid HEX does not corrupt favorite or theme', `JSON.parse(localStorage.getItem('polyhedron-accent-favorites'))[3]==='#ABCDEF' && window.savedConfig.theme_accent==='#ABCDEF'`)
  await evaluate('window.mount(1)')
  await check('favorites survive remount and config reload', `document.querySelectorAll('[aria-label="Favorite accent colors"] button')[3].ariaLabel.includes('#ABCDEF')`)
  await click(0)
  await check('first preset restores default accent without overwriting favorites', `document.documentElement.style.getPropertyValue('--poly-accent')==='#8C52FF' && JSON.parse(localStorage.getItem('polyhedron-accent-favorites'))[3]==='#ABCDEF'`)
  for (let index=0; index<3; index++) {
    await click(index)
    await edit('#112233')
    await evaluate(`document.querySelectorAll('[aria-label="Favorite accent colors"] button')[${index}].dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true}))`)
    await check('default '+(index+1)+' cannot be changed or deleted', `JSON.stringify(JSON.parse(localStorage.getItem('polyhedron-accent-favorites')).slice(0,3))===JSON.stringify(['#8C52FF','#A7F175','#ED1C24'])`)
  }
  for (const index of [3,4]) {
    await click(index)
    await evaluate(`document.querySelectorAll('[aria-label="Favorite accent colors"] button')[${index}].dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true}))`)
    await check('right-click clears custom slot '+(index+1)+' without changing accent', `JSON.parse(localStorage.getItem('polyhedron-accent-favorites'))[${index}]===null && document.querySelectorAll('[aria-label="Favorite accent colors"] button')[${index}].ariaPressed==='false' && document.documentElement.style.getPropertyValue('--poly-accent')==='${index===3?'#ABCDEF':'#654321'}'`)
  }
  await evaluate('window.mount(2)')
  await check('cleared slots stay empty after remount', `JSON.parse(localStorage.getItem('polyhedron-accent-favorites')).slice(3).every(color=>color===null)`)
  await evaluate(`document.querySelector('button[aria-haspopup="listbox"]').click()`)
  await check('text-color dropdown offers White and Black', `(() => {
    const options=[...document.querySelectorAll('[role="listbox"] button')];
    return options.length===2 && options.some(item=>item.textContent==='White') && options.some(item=>item.textContent==='Black');
  })()`)
  await evaluate(`[...document.querySelectorAll('[role="listbox"] button')].find(item=>item.textContent==='Black').click()`)
  await check('Black applies and persists', `window.savedConfig.theme_accent_foreground==='black' && document.documentElement.style.getPropertyValue('--poly-accent-foreground')==='#101010'`)
  await evaluate(`document.querySelector('button[aria-haspopup="listbox"]').click()`)
  await settle()
  await evaluate(`[...document.querySelectorAll('[role="listbox"] button')].find(item=>item.textContent==='White').click()`)
  await check('White applies and persists', `window.savedConfig.theme_accent_foreground==='white' && document.documentElement.style.getPropertyValue('--poly-accent-foreground')==='#ffffff'`)
  win.destroy()
  app.quit()
}

run().catch(error => { console.error(error); app.exit(1) })
