const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createRequire } = require('node:module')

async function run() {
  const root = path.resolve(__dirname, '..')
  const base = path.join(root, 'src/renderer/src')
  const sources = []
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(file)
      else if (/\.tsx?$/.test(entry.name)) sources.push(await fs.readFile(file, 'utf8'))
    }
  }
  await walk(base)
  const styles = await fs.readFile(path.join(base, 'features/translate/components/styles.ts'), 'utf8')
  const saveClass = styles.match(/export const btnPrimary\s*=\s*'([^']+)'/)[1]
  const solid = /(?:^|\s)(?:bg-amber-500(?:\/90)?|accent-solid-(?:button|control))(?:\s|$)/
  const classes = [...new Set(sources.flatMap(source => [...source.matchAll(/className="([^"]+)"/g)].map(m => m[1])).filter(cls => solid.test(cls)))]
  classes.push('accent-solid-button', 'accent-solid-control', saveClass + ' accent-solid-button')
  const aiSource = await fs.readFile(path.join(base, 'components/translation/AITranslateModal.tsx'), 'utf8')
  const askClass = aiSource.match(/disabled=\{translating\}\s+className="([^"]+)"/)[1]
  if (!classes.includes(askClass)) throw new Error('Ask Gemini was not included in audit')
  const candidates = sources.flatMap(source => source.split(/[\s"'`{}]+/))
  const cssPath = path.join(base, 'assets/main.css')
  const { compile } = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const compiled = await compile(await fs.readFile(cssPath, 'utf8'), { base: path.dirname(cssPath), onDependency: () => {} })
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 1400, height: 1000 })
  const escape = s => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  const buttons = classes.map((cls, i) => `<button id="action-${i}" class="${escape(cls)}">Action</button>`).join('')
  await win.loadURL('data:text/html,' + encodeURIComponent(`<html data-theme="liquid-glass"><body><div class="app-content-shell"><main><button id="save" class="${saveClass}">SAVE</button><div class="spells-page">${buttons}</div></main></div><div class="app-modal-panel">${buttons.replaceAll('action-', 'portal-')}</div><button id="disabled" disabled class="${askClass}">Disabled</button><button id="aria-disabled" aria-disabled="true" class="accent-solid-control">Disabled</button><button id="blocked" class="bg-amber-500 cursor-not-allowed">Blocked</button><button id="preview" class="bg-amber-500 settings-button-preview">Preview</button><button id="export" class="bg-amber-500 workspace-export-button">Export</button><button id="switch" role="switch" class="bg-amber-500">Switch</button><button id="tinted" class="bg-amber-500/10">Selected</button></body></html>`))
  await win.webContents.insertCSS(compiled.build([...new Set(candidates)]))
  await win.webContents.insertCSS('button{transition:none!important}')
  const js = s => win.webContents.executeJavaScript(s)
  await js(`window.snapshot=id=>{const s=getComputedStyle(document.getElementById(id));return {background:s.backgroundColor,border:s.borderTopColor,shadow:s.boxShadow,filter:s.filter,color:s.color}};undefined`)
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('DOM.enable')
  await win.webContents.debugger.sendCommand('CSS.enable')
  const { root: doc } = await win.webContents.debugger.sendCommand('DOM.getDocument')
  const ids = ['save', ...classes.flatMap((_, i) => ['action-' + i, 'portal-' + i]), 'disabled', 'aria-disabled', 'blocked', 'preview', 'export', 'switch', 'tinted']
  const nodes = []
  for (const id of ids) nodes.push((await win.webContents.debugger.sendCommand('DOM.querySelector', { nodeId: doc.nodeId, selector: '#' + id })).nodeId)
  for (const theme of ['liquid-glass', 'classic', 'polyhedron-green', 'midnight']) {
    for (const foreground of ['#101010', '#ffffff']) {
      await js(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.documentElement.style.cssText='--poly-accent:#A7F175;--poly-accent-rgb:167 241 117;--color-amber-500:#A7F175;--color-amber-400:#c1f59e;--poly-accent-foreground:${foreground}';undefined`)
      for (const nodeId of nodes) await win.webContents.debugger.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
      const before = await js(`Object.fromEntries(${JSON.stringify(ids)}.map(id=>[id,window.snapshot(id)]))`)
      for (const nodeId of nodes) await win.webContents.debugger.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] })
      const after = await js(`Object.fromEntries(${JSON.stringify(ids)}.map(id=>[id,window.snapshot(id)]))`)
      for (const id of ids.filter(id => /^(action|portal)-/.test(id))) {
        const cls = classes[Number(id.split('-')[1])]
        if (JSON.stringify(after[id]) !== JSON.stringify(after.save)) throw new Error(`${theme} ${id}: ${JSON.stringify(after[id])} != SAVE ${JSON.stringify(after.save)}`)
      }
      if (after.save.background === before.save.background || after.save.shadow === 'none') throw new Error('SAVE must change color and glow')
      for (const id of ['disabled', 'aria-disabled', 'blocked']) {
        if (JSON.stringify(before[id]) !== JSON.stringify(after[id]) || after[id].shadow !== 'none') throw new Error('Disabled hover: ' + id)
      }
      if (JSON.stringify(after.preview) !== JSON.stringify(after.save)) throw new Error('Preview hover must match SAVE')
      if (JSON.stringify(after.export) !== JSON.stringify(after.save)) throw new Error('Export Workspace hover must match SAVE')
      // Tailwind uses oklab while the existing selected-tint hover uses srgb;
      // both serialize differently, but must retain the same accent and 10% alpha.
      if (!/0\.1\)/.test(after.tinted.background) && !/\/ 0\.1\)/.test(after.tinted.background)) throw new Error('Selected tint changed on hover: ' + after.tinted.background)
      if (after.switch.shadow === after.save.shadow) throw new Error('Switch inherited solid action hover')
      console.log(`PASS: ${theme}, ${foreground}, ${classes.length} solid variants in pages and portals; Ask Gemini, Preview and Export Workspace match SAVE; disabled actions unchanged`)
    }
  }
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
