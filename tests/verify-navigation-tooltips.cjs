const { app, BrowserWindow } = require('electron')
const { createRequire } = require('node:module')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')

const root = path.resolve(__dirname, '..')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function run() {
  app.setPath('userData', await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-tooltip-test-')))
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  await app.whenReady()
  const bundle = await build({
    absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { resolveDir: root, loader: 'jsx', contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { MemoryRouter, useNavigate } from 'react-router-dom';
      import { Sidebar } from './src/renderer/src/components/layout/Sidebar';
      function Bridge() { window.testNavigate = useNavigate(); return null }
      createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/translate']}><Bridge/><Sidebar/></MemoryRouter>);
    ` },
    plugins: [{ name: 'isolated-sidebar-contexts', setup(builder) {
      builder.onResolve({ filter: /^@\// }, args => ({ path: args.path, namespace: 'mock' }))
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => {
        if (args.path === '@/context/TranslationSession') return { contents: 'export const useTranslationSession=()=>({gameProfile:"bg3",phase:"loaded",modName:"Test"})' }
        if (args.path === '@/i18n/useAppTranslation') return { contents: 'export const useAppTranslation=()=>({t:key=>key})' }
        if (args.path === '@/lib/utils') return { contents: 'export const cn=(...items)=>items.filter(Boolean).join(" ")' }
        throw new Error('Unexpected mock: '+args.path)
      })
    }}]
  })
  const win = new BrowserWindow({ show: false, width: 800, height: 600,
    webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (_event, _level, message) => console.log('Renderer: '+message))
  await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<div id="root"></div>'))
  await win.webContents.executeJavaScript(bundle.outputFiles[0].text)
  const evaluate = source => win.webContents.executeJavaScript(source, true)
  await delay(100)
  const check = async (name, expression) => {
    if (!await evaluate(expression)) throw new Error(name)
    console.log('PASS: '+name)
  }
  const hover = async () => {
    await evaluate(`document.querySelector('a[href="/translate"]').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`)
    await delay(50)
  }
  await hover()
  await check('hover opens tooltip', `!!document.querySelector('[role="tooltip"]')`)
  await evaluate(`document.querySelector('a[href="/translate"]').click()`)
  await delay(50)
  await check('clicking even the active tab closes tooltip', `!document.querySelector('[role="tooltip"]')`)
  await hover()
  await evaluate(`window.testNavigate('/workspace')`)
  await delay(50)
  await check('route change closes tooltip without mouseleave', `!document.querySelector('[role="tooltip"]')`)
  await hover()
  await evaluate(`window.dispatchEvent(new CustomEvent('polyhedron:navigation-start'))`)
  await delay(50)
  await check('navigation start immediately closes tooltip', `!document.querySelector('[role="tooltip"]')`)
  await hover()
  await evaluate(`window.dispatchEvent(new Event('blur'))`)
  await delay(50)
  await check('losing window focus closes tooltip', `!document.querySelector('[role="tooltip"]')`)
  // Chromium doesn't activate keyboard focus rings in a hidden window. Exercise
  // both focus-visible branches explicitly, while retaining real React events.
  await evaluate(`(() => {
    const link=document.querySelector('a[href="/translate"]');
    const nativeMatches=link.matches.bind(link);
    link.matches=selector=>selector===':focus-visible' ? false : nativeMatches(selector);
    link.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));
  })()`)
  await delay(50)
  await check('mouse focus does not reopen tooltip', `!document.querySelector('[role="tooltip"]')`)
  await evaluate(`(() => {
    const link=document.querySelector('a[href="/translate"]');
    const nativeMatches=Element.prototype.matches.bind(link);
    link.matches=selector=>selector===':focus-visible' ? true : nativeMatches(selector);
    link.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));
  })()`)
  await delay(50)
  await check('keyboard-visible focus still opens tooltip', `document.querySelector('a[href="/translate"]').matches(':focus-visible') && !!document.querySelector('[role="tooltip"]')`)
  await evaluate(`document.querySelector('a[href="/translate"]').dispatchEvent(new FocusEvent('focusout',{bubbles:true}))`)
  await delay(50)
  await check('focus leaving closes tooltip', `!document.querySelector('[role="tooltip"]')`)
  win.destroy()
  app.exit(0)
}
run().catch(error => { console.error(error.stack); app.exit(1) })
