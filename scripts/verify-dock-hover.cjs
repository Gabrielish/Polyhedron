const { app, BrowserWindow } = require('electron')
const { createRequire } = require('node:module')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const root = path.resolve(__dirname, '..'), base = path.join(root, 'src/renderer/src')
  const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useNavigate} from 'react-router-dom';import {Sidebar} from './src/renderer/src/components/layout/Sidebar';function Bridge(){window.navigate=useNavigate();return null};createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/workspace']}><Bridge/><Sidebar/></MemoryRouter>);`
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({ absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: root, loader: 'jsx', contents: fixture }, plugins: [{ name: 'sidebar-mocks', setup(b) {
    b.onResolve({ filter: /^@\// }, args => ({ path: args.path, namespace: 'mock' }))
    b.onLoad({ filter: /.*/, namespace: 'mock' }, args => {
      if (args.path === '@/context/TranslationSession') return { contents: 'export const useTranslationSession=()=>({gameProfile:"bg3",phase:"loaded",modName:"Test"})' }
      if (args.path === '@/i18n/useAppTranslation') return { contents: 'export const useAppTranslation=()=>({t:key=>key})' }
      if (args.path === '@/lib/utils') return { contents: 'export const cn=(...items)=>items.filter(Boolean).join(" ")' }
      throw new Error('Unexpected mock ' + args.path)
    })
  } }] })
  const source = await fs.readFile(path.join(base, 'components/layout/Sidebar.tsx'), 'utf8')
  const cssPath = path.join(base, 'assets/main.css'), { compile } = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const css = await compile(await fs.readFile(cssPath, 'utf8'), { base: path.dirname(cssPath), onDependency: () => {} })
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 1200, height: 700 })
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body><div id="root"></div></body></html>')
  await win.webContents.insertCSS(css.build([...new Set((source + fixture).split(/[\s"'`{}]+/))]))
  await win.webContents.insertCSS('*{transition:none!important}')
  const js = s => win.webContents.executeJavaScript(s)
  const settle = () => new Promise(r => setTimeout(r, 80))
  await js(bundle.outputFiles[0].text); await settle()
  const dbg = win.webContents.debugger; dbg.attach('1.3')
  await dbg.sendCommand('DOM.enable'); await dbg.sendCommand('CSS.enable')
  const { root: document } = await dbg.sendCommand('DOM.getDocument')
  for (const width of [1200, 375]) {
    win.setSize(width, 700); await settle()
    const geometry = await js(`(()=>{const nav=document.querySelector('.sidebar-nav'),dock=document.querySelector('.sidebar-shell'),s=getComputedStyle(nav),r=dock.getBoundingClientRect();return [s.overflowX,s.overflowY,r.left,r.right,nav.scrollWidth,nav.clientWidth]})()`)
    if (geometry[0] !== 'visible' || geometry[1] !== 'visible' || geometry[2] < 0 || geometry[3] > width || geometry[4] > geometry[5] + 1) throw new Error('Dock clipping/overflow: ' + JSON.stringify(geometry))
    for (const route of ['/translate', '/consistency', '/dialogues', '/game-data', '/spells', '/workspace', '/settings']) {
      const { nodeId } = await dbg.sendCommand('DOM.querySelector', { nodeId: document.nodeId, selector: `a[href="${route}"]` })
      await dbg.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] })
      for (const active of [false, true]) {
        await js(`window.navigate('${active ? route : route === '/game-data' ? '/workspace' : '/game-data'}');undefined`); await settle()
        const style = await js(`(()=>{const a=document.querySelector('a[href="${route}"]'),s=getComputedStyle(a),i=getComputedStyle(a.querySelector('svg'));return [s.backgroundColor,s.boxShadow,s.borderColor,i.filter,a.getAttribute('aria-current')]})()`)
        if (style[0] !== 'rgba(0, 0, 0, 0)' || style[1] !== 'none' || style[2] !== 'rgba(0, 0, 0, 0)' || (active && (!style[3].includes('drop-shadow') || style[4] !== 'page'))) throw new Error(route + ' incorrect hover: ' + JSON.stringify(style))
      }
      await dbg.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
    }
  }
  win.setSize(320, 700); await settle()
  if (!await js(`getComputedStyle(document.querySelector('.sidebar-nav')).overflowX==='auto'`)) throw new Error('Narrow-screen scrolling lost')
  console.log('PASS: all seven dock routes hover transparently, active icon glow survives, nav/footer seam does not clip at desktop/mobile widths, very narrow scrolling retained')
  win.destroy(); app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
