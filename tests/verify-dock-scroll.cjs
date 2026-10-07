// Real DOM/CSS layout regression check; no application bundle/build is produced.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const ts = require('typescript')
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
const root = path.resolve(__dirname, '..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'polyhedron-dock-scroll-'))
app.setPath('userData', temp)
const css = fs.readFileSync(path.join(root, 'src/renderer/src/assets/main.css'), 'utf8').replace(/^@import.*$/gm, '')
const hook = ts.transpileModule(fs.readFileSync(path.join(root, 'src/renderer/src/hooks/useDockClearance.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const frame = `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))`
app.whenReady().then(async () => {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const win = new BrowserWindow({ show: false, width, height, webPreferences: { offscreen: true } })
    await win.loadURL('data:text/html,' + encodeURIComponent(`<!doctype html><html data-theme="liquid-glass"><body style="margin:0;overflow:hidden;background:#080808;color:#ddd">
      <div class="sidebar-shell" style="position:fixed;z-index:1000;bottom:24px;left:50%;width:300px;height:58px;text-align:center;line-height:58px">Navigation</div>
      <div class="app-content-shell" style="height:100vh;display:flex;flex-direction:column">
        <header style="height:40px;flex-shrink:0">Title</header>
        <main class="app-route-viewport" style="position:relative;display:flex;flex-direction:column;flex:1;min-height:0;overflow:auto"></main>
      </div></body></html>`))
    await win.webContents.insertCSS(css)
    await win.webContents.executeJavaScript(`(()=>{
      const module={};new Function('require','exports',${JSON.stringify(hook)})(()=>({useLayoutEffect:callback=>{window.cleanupDock=callback()}}),module);
      module.useDockClearance('/fixture');
    })()`)
    for (const route of ['Translate side', 'Translate stacked', 'Consistency', 'Dialogue Nodes', 'Spells', 'Glossary', 'Workspace / Mods', 'Settings']) {
      await win.webContents.executeJavaScript(`(()=>{
        const viewport=document.querySelector('.app-route-viewport');
        viewport.innerHTML='<section style="display:flex;flex-direction:column;min-height:0;flex:1"><header style="flex-shrink:0;height:50px">${route}</header><div id="scrollport" class="app-dock-scroll" style="flex:1;min-height:0;overflow:auto;box-sizing:border-box">'+Array.from({length:30},(_,i)=>'<div style="height:60px;box-sizing:border-box;border:1px solid #292929">'+(i===29?'Last item':i)+'</div>').join('')+'</div></section>';
      })()`)
      await win.webContents.executeJavaScript(frame)
      const result = await win.webContents.executeJavaScript(`(()=>{
        const scroll=document.querySelector('#scrollport');scroll.scrollTop=scroll.scrollHeight;
        const before=scroll.scrollTop;scroll.scrollTop+=500;
        const last=scroll.lastElementChild.getBoundingClientRect(),port=scroll.getBoundingClientRect(),dock=document.querySelector('.sidebar-shell').getBoundingClientRect();
        return {dockGap:dock.top-last.bottom,fullHeight:Math.abs(port.bottom-innerHeight)<1,stopped:scroll.scrollTop===before,outerScroll:document.querySelector('.app-route-viewport').scrollHeight-document.querySelector('.app-route-viewport').clientHeight};
      })()`)
      assert(result.fullHeight, `${route}: viewport must extend behind the dock, without a bottom band`)
      assert(result.dockGap > 0 && result.dockGap <= 2, `${route}: expected 1px gap with device-pixel rounding (${result.dockGap}px)`)
      assert(result.stopped)
      assert(result.outerScroll <= 1, `${route}: nested route creates extra outer scroll`)
    }
    // Mobile floating pagination can be higher than the dock: reserve its space too.
    await win.webContents.executeJavaScript(`(()=>{const footer=document.createElement('div');footer.className='translation-pagination-footer';footer.style.cssText='position:fixed;left:10px;bottom:110px;height:42px;width:100px';footer.textContent='Pagination';document.querySelector('.app-content-shell').appendChild(footer)})()`)
    await win.webContents.executeJavaScript(frame)
    const paginationGap = await win.webContents.executeJavaScript(`(()=>{const scroll=document.querySelector('#scrollport');scroll.scrollTop=scroll.scrollHeight;return document.querySelector('.translation-pagination-footer').getBoundingClientRect().top-scroll.lastElementChild.getBoundingClientRect().bottom})()`)
    assert(paginationGap > 0 && paginationGap <= 2)
    await win.webContents.executeJavaScript(`document.querySelector('.translation-pagination-footer').remove()`)
    await win.webContents.executeJavaScript(frame)
    // The Mods dropdown alignment must coincide with the final scroll position.
    const mods = await win.webContents.executeJavaScript(`(async()=>{
      const viewport=document.querySelector('.app-route-viewport');
      viewport.innerHTML='<div class="workspace-page-shell" style="height:100%;min-height:0;overflow:auto;box-sizing:border-box"><div style="height:1000px">Earlier workspace cards</div><div class="mods-embedded"><header style="height:60px">Mods dropdown</header><div id="last-card" style="height:300px;background:#101010;border:1px solid #292929">Create package</div></div></div>';
      await ${frame};document.querySelector('.mods-embedded').scrollIntoView({behavior:'instant',block:'end',inline:'nearest'});
      const scroll=document.querySelector('.workspace-page-shell'),before=scroll.scrollTop;
      scroll.scrollTop=scroll.scrollHeight;
      return {extra:scroll.scrollTop-before,gap:document.querySelector('.sidebar-shell').getBoundingClientRect().top-document.querySelector('#last-card').getBoundingClientRect().bottom};
    })()`)
    assert(mods.extra <= 1, `Mods: extra scroll left after dropdown positioning (${mods.extra})`)
    assert(mods.gap > 0 && mods.gap <= 2)
    // Theme switching must restore the original sidebar layout without reserved space.
    await win.webContents.executeJavaScript(`document.documentElement.dataset.theme='classic'`)
    await win.webContents.executeJavaScript(frame)
    assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.app-route-viewport')).marginBottom`), '0px')
    await win.webContents.executeJavaScript(`document.documentElement.dataset.theme='liquid-glass'`)
    await win.webContents.executeJavaScript(frame)
    await win.webContents.executeJavaScript(`const scroll=document.querySelector('.workspace-page-shell');scroll.scrollTop=scroll.scrollHeight`)
    await win.webContents.executeJavaScript(frame)
    const finalGap = await win.webContents.executeJavaScript(`document.querySelector('.sidebar-shell').getBoundingClientRect().top-document.querySelector('#last-card').getBoundingClientRect().bottom`)
    assert(finalGap > 0 && finalGap <= 2)
    await new Promise(resolve => setTimeout(resolve, 150))
    fs.writeFileSync(path.join(temp, `dock-${width}.png`), (await win.webContents.capturePage()).toPNG())
    await win.webContents.executeJavaScript('window.cleanupDock()')
    win.destroy()
    console.log(`PASS ${width}px: full-height content behind dock, exact last-card boundary, Mods dropdown stop, footer resizing and theme switching`)
  }
  const grid = fs.readFileSync(path.join(root, 'src/renderer/src/components/translation/TranslationGrid.tsx'), 'utf8')
  assert(!grid.includes('paginationBottomSpacer'))
  assert(!fs.readFileSync(path.join(root, 'src/renderer/src/pages/ModsPage.tsx'), 'utf8').includes('mods-bottom-spacer'))
  assert(!fs.readFileSync(path.join(root, 'src/renderer/src/pages/ReferencePage.tsx'), 'utf8').includes('app-dock-scroll'), 'Game Data keeps its original list and webview scrolling')
  console.log(`Previews: ${temp}`)
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
