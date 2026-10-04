const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const Database = require('better-sqlite3')

const root = path.resolve(__dirname, '..')
const optimized = process.argv.includes('--optimized')
const translate = process.argv.includes('--translate')
const pageSelector = translate ? '.translate-page' : '.spells-page'
const readySelector = translate ? '.translate-page textarea' : '.spells-page .spell-card'
const targetPath = translate ? '/translate' : '/spells'
const awayPath = translate ? '/workspace' : '/translate'
const realProfile = path.join(app.getPath('appData'), 'polyhedron')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const timeout = setTimeout(() => { console.error('UI test timed out'); app.exit(1) }, 240000)
let testProfile

// Hidden, unthrottled real Electron renderer, not a synthetic component test.
BrowserWindow.prototype.show = function () {}
app.on('browser-window-created', (_, win) => win.webContents.setBackgroundThrottling(false))

async function prepare() {
  testProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-tab-ui-'))
  app.setPath('userData', testProfile)
  app.setAppPath(root)
  const realDb = new Database(path.join(realProfile, 'polyhedron.db'), { readonly: true })
  const config = Object.fromEntries(realDb.prepare('SELECT key,value FROM config').all().map(row => [row.key, row.value]))
  const project = realDb.prepare('SELECT name,last_file_path FROM mod WHERE name = ?').get(config.last_project_bg3)
    ?? realDb.prepare('SELECT name,last_file_path FROM mod WHERE last_file_path IS NOT NULL LIMIT 1').get()
  if (!project?.last_file_path) throw new Error('No saved project found')
  await realDb.backup(path.join(testProfile, 'polyhedron.db'))
  realDb.close()
  const sourceLang = config.last_source_lang || 'en'
  const targetLang = config.last_target_lang || 'ro'
  const modDir = path.join(testProfile, 'mods', project.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100))
  await fs.mkdir(modDir, { recursive: true })
  const sourcePath = project.last_file_path
  const copiedPath = path.join(modDir, path.basename(sourcePath))
  await fs.copyFile(sourcePath, copiedPath)
  const db = new Database(path.join(testProfile, 'polyhedron.db'))
  db.prepare('UPDATE mod SET last_file_path = ? WHERE name = ?').run(copiedPath, project.name)
  db.close()
  const sessionDir = path.join(testProfile, 'sessions')
  await fs.mkdir(sessionDir)
  const savedFile = path.join(realProfile, 'sessions', hash(`${sourcePath}|${sourceLang}|${targetLang}`) + '.json')
  const savedPayload = JSON.parse(await fs.readFile(savedFile, 'utf8'))
  const saved = Array.isArray(savedPayload) ? savedPayload : savedPayload.entries
  await fs.copyFile(savedFile, path.join(sessionDir, hash(`${copiedPath}|${sourceLang}|${targetLang}`) + '.json'))
  console.log(JSON.stringify({stage:'profile-ready', project:project.name, sessionRows:saved.length, profile:testProfile}))
  const originalHandle = ipcMain.handle.bind(ipcMain)
  const loadStages = []
  ipcMain.handle = (channel, handler) => originalHandle(channel, async (...args) => {
    const start = performance.now()
    const result = await handler(...args)
    if (['xml:load','session:load','mod:prepareTranslationInput','mod:completeTranslationImport','mod:upsert'].includes(channel)) {
      const item = { channel, durationMs: Math.round(performance.now()-start) }
      loadStages.push(item)
      console.log(JSON.stringify({stage:'load-stage',...item}))
    }
    return result
  })
  require(path.join(root, 'out/main/index.js'))
  await app.whenReady()
  let win
  for (let i=0;i<100;i++) {
    win = BrowserWindow.getAllWindows()[0]
    if (win && !win.webContents.isLoadingMainFrame()) break
    await delay(200)
  }
  if (!win) throw new Error('No app window')
  const wc = win.webContents
  const evaluate = code => wc.executeJavaScript(code, true)
  for (let i=0;i<100;i++) {
    const buttons = await evaluate(`Array.from(document.querySelectorAll('button')).map(b=>({text:b.textContent.trim(),disabled:b.disabled}))`)
    const ready = buttons.find(b => /open.*editor|start.*translat|load.*file|open.*file/i.test(b.text) && !b.disabled)
    if (ready) {
      console.log(JSON.stringify({stage:'open-editor-button',button:ready.text}))
      await evaluate(`window.__editorOpenStart=performance.now()`)
      await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(ready.text)}).click()`)
      break
    }
    if (i===99) throw new Error('No ready open editor button: ' + JSON.stringify(buttons))
    await delay(200)
  }
  for (let i=0;i<400;i++) {
    if (await evaluate(`!!document.querySelector('a[href="#/spells"]')`)) break
    if (i===399) throw new Error('Translate project did not finish loading')
    await delay(200)
  }
  await delay(1000)
  const initialTranslate = await evaluate(`({ elapsed:performance.now()-window.__editorOpenStart, rows:document.querySelectorAll('.translate-page textarea').length })`)
  console.log(JSON.stringify({stage:'initial-translate',...initialTranslate}))
  if (process.argv.includes('--load-only')) {
    await fs.writeFile(path.join(root,'tab-ui-translate-load-stages.json'),JSON.stringify({initialTranslate,loadStages},null,2))
    clearTimeout(timeout)
    app.exit(0)
    return
  }
  console.log(JSON.stringify({stage:'translate-ready',window:win.getSize()}))
  await evaluate(`(() => {
    window.__tabTest = { active:0, requests:0 };
    const original = window.fetch;
    window.fetch = async (...args) => {
      window.__tabTest.active++; window.__tabTest.requests++;
      try { return await original(...args) } finally { window.__tabTest.active-- }
    };
  })()`)
  wc.debugger.attach('1.3')
  await wc.debugger.sendCommand('Network.enable')
  const activeRequests = new Set()
  let lastNetwork = Date.now()
  wc.debugger.on('message', (_, method, params) => {
    if (method === 'Network.requestWillBeSent') {activeRequests.add(params.requestId); lastNetwork=Date.now()}
    if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {activeRequests.delete(params.requestId); lastNetwork=Date.now()}
  })
  const measurements = []
  for (let run=0;run<(process.argv.includes('--qa-only') ? 1 : 3);run++) {
    if (run || translate) {
      await evaluate(`document.querySelector('a[href="#${awayPath}"]').click()`)
      for (let i=0;i<200;i++) {
        if (await evaluate(`location.hash==='#${awayPath}' && !document.querySelector('${pageSelector}')`)) break
        await delay(50)
      }
      await delay(500)
    }
    activeRequests.clear()
    lastNetwork=Date.now()
    await evaluate(`(() => {
      const state = window.__tabTest;
      state.start=performance.now(); state.longTasks=[]; state.firstCards=null; state.firstRowsDom=null; state.lastMutation=state.start;
      state.observer = new MutationObserver(() => {
        state.lastMutation=performance.now();
        if (!state.firstRowsDom && document.querySelector('${readySelector}')) state.firstRowsDom=performance.now()-state.start;
        if (!state.firstCards && document.querySelector('${readySelector}'))
          requestAnimationFrame(()=>requestAnimationFrame(()=>{ if (!state.firstCards) state.firstCards=performance.now()-state.start }));
      });
      state.observer.observe(document.querySelector('main'), {subtree:true,childList:true,attributes:true});
      state.tasks = new PerformanceObserver(list => state.longTasks.push(...list.getEntries().map(t=>t.duration)));
      state.tasks.observe({type:'longtask'});
      document.querySelector('a[href="#${targetPath}"]').click();
    })()`)
    let snapshot
    let settled = false
    for (let i=0;i<900;i++) {
      snapshot = await evaluate(`(() => {
        const state=window.__tabTest;
        const images=Array.from(document.querySelectorAll('${pageSelector} img')).filter(img=>{
          const r=img.getBoundingClientRect();return r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth;
        });
        return {elapsed:performance.now()-state.start,firstCards:state.firstCards,firstRowsDom:state.firstRowsDom,
          cards:document.querySelectorAll('${readySelector}').length,
          deferredCards:document.querySelectorAll('[data-deferred-spell-card="pending"]').length,
          pendingVisibleCards:Array.from(document.querySelectorAll('[data-deferred-spell-card="pending"]')).filter(e=>{const r=e.getBoundingClientRect();return r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth}).length,
          visibleImages:images.length, pendingVisibleImages:images.filter(img=>!img.complete).length,
          failedVisibleImages:images.filter(img=>img.complete && !img.naturalWidth).length,
          fetchActive:state.active,requests:state.requests,
          domQuietMs:performance.now()-state.lastMutation,fonts:document.fonts.status,
          longTasks:state.longTasks};
      })()`)
      if (snapshot.firstCards && snapshot.pendingVisibleCards===0 && snapshot.pendingVisibleImages===0 && snapshot.fetchActive===0 &&
        snapshot.domQuietMs>500 && snapshot.fonts==='loaded' && activeRequests.size===0 && Date.now()-lastNetwork>500) {
        settled=true; break
      }
      if (i===100 || i===300 || i===600) console.log(JSON.stringify({stage:'waiting',run:run+1,...snapshot,networkActive:activeRequests.size}))
      await delay(100)
    }
    await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
    const result = {run:run+1,kind:run===0?'cold':'warm',fullySettled:settled,...snapshot,networkActive:activeRequests.size}
    measurements.push(result)
    console.log(JSON.stringify({stage:'measurement',...result}))
    await evaluate(`window.__tabTest.observer.disconnect();window.__tabTest.tasks.disconnect()`)
  }
  const checks = []
  if (optimized && translate) {
    const check = async (name, expression) => {
      const passed = await evaluate(expression)
      checks.push({name, passed})
      console.log(JSON.stringify({stage:'check',name,passed}))
      if (!passed) throw new Error('Translate regression: '+name)
    }
    await check('virtualized editor rows loaded', `document.querySelectorAll('.translate-page textarea').length > 0 && document.querySelectorAll('.translate-page textarea').length < 100`)
    await evaluate(`Array.from(document.querySelectorAll('.translate-page button')).find(b=>b.textContent.trim().startsWith('Untranslated')).click()`)
    await delay(1000)
    await check('untranslated filter', `document.querySelectorAll('.translate-page textarea').length>0 && Array.from(document.querySelectorAll('.translate-page textarea')).every(e=>!e.value.trim())`)
    await evaluate(`Array.from(document.querySelectorAll('.translate-page button')).find(b=>b.textContent.trim().startsWith('Translated')).click()`)
    await delay(1000)
    await check('translated filter', `document.querySelectorAll('.translate-page textarea').length>0 && Array.from(document.querySelectorAll('.translate-page textarea')).every(e=>e.value.trim())`)
    await evaluate(`Array.from(document.querySelectorAll('.translate-page button')).find(b=>/^All[ 0-9]/.test(b.textContent.trim()) && !b.textContent.trim().startsWith('All statuses') && !b.textContent.trim().startsWith('All speakers')).click()`)
    await delay(500)
    await evaluate(`(() => {
      const input=document.querySelector('.translate-page .translation-search-input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'polyhedron-no-match-8f714ea1');
      input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`)
    await delay(1200)
    await check('search filters complete session', `document.querySelectorAll('.translate-page textarea').length===0`)
    await evaluate(`(() => {
      const input=document.querySelector('.translate-page .translation-search-input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');
      input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`)
    await delay(1000)
    await check('rows restored after clearing search', `document.querySelectorAll('.translate-page textarea').length>0`)
    await evaluate(`document.querySelector('.translate-page input.translation-selection-checkbox').click()`)
    await delay(300)
    await check('selection still works', `!!document.querySelector('.translate-page input.translation-selection-checkbox:checked')`)
    await evaluate(`document.querySelector('.translate-page .translation-batch-action-bar button').click()`)
    await delay(300)
    console.log(JSON.stringify({stage:'regression-checks',checks}))
  }
  if (optimized && !translate) {
    const check = async (name, expression) => {
      const passed = await evaluate(expression)
      checks.push({ name, passed })
      console.log(JSON.stringify({ stage:'check', name, passed }))
      if (!passed) throw new Error('Spells regression: ' + name)
    }
    await check('offscreen contents deferred', `document.querySelectorAll('[data-deferred-spell-card="pending"]').length > 500`)
    await evaluate(`document.querySelector('[data-deferred-spell-card]:last-child').scrollIntoView()`)
    await delay(1200)
    await check('last card loads after jump to bottom', `Array.from(document.querySelectorAll('[data-deferred-spell-card]')).at(-1)?.dataset.deferredSpellCard === 'ready'`)
    await evaluate(`document.querySelector('.spells-page .polyhedron-scroll').scrollTop=0`)
    await delay(600)
    await evaluate(`document.querySelector('button[aria-label="List view"]').click()`)
    await delay(600)
    await check('list view works', `document.querySelector('button[aria-label="List view"]').getAttribute('aria-pressed') === 'true'`)
    await evaluate(`document.querySelector('button[aria-label="Cards view"]').click()`)
    await delay(600)
    await check('visible cards do not overlap', `(() => {
      const cards=Array.from(document.querySelectorAll('.spell-card')).map(e=>e.getBoundingClientRect()).filter(r=>r.top>0&&r.top<innerHeight);
      return cards.every((a,i)=>cards.every((b,j)=>i===j || a.right<=b.left+1 || b.right<=a.left+1 || a.bottom<=b.top+1 || b.bottom<=a.top+1));
    })()`)
    await evaluate(`Array.from(document.querySelectorAll('.spells-page section button[aria-expanded]')).find(b=>/cantrip|level/i.test(b.textContent))?.click()`)
    await delay(300)
    await check('level collapse works without computing hidden cards', `!!Array.from(document.querySelectorAll('.spells-page section button[aria-expanded]')).find(b=>b.getAttribute('aria-expanded')==='false' && /cantrip|level/i.test(b.textContent))`)
    await evaluate(`Array.from(document.querySelectorAll('.spells-page section button[aria-expanded]')).find(b=>b.getAttribute('aria-expanded')==='false' && /cantrip|level/i.test(b.textContent))?.click()`)
    await delay(300)
    await evaluate(`(() => {
      const input=document.querySelector('.spells-toolbar input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Acid Splash');
      input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`)
    await delay(800)
    await check('search filters full catalog', `Array.from(document.querySelectorAll('.spell-card h3')).length>0 && Array.from(document.querySelectorAll('.spell-card h3')).every(e=>e.textContent.toLowerCase().includes('acid splash'))`)
    await evaluate(`document.querySelector('.spell-card button[aria-label="Edit spell"]').click()`)
    await delay(500)
    await check('edit dialog opens for deferred card', `!!document.querySelector('[role="dialog"] button[aria-label="Close edit dialog"]')`)
    await evaluate(`document.querySelector('button[aria-label="Close edit dialog"]').click()`)
    await delay(200)
    await check('edit dialog closes', `!document.querySelector('[role="dialog"] button[aria-label="Close edit dialog"]')`)
    await evaluate(`document.querySelector('button[aria-label="Clear search"]').click()`)
    await delay(700)
    await evaluate(`document.querySelector('.spells-toolbar button[aria-haspopup="listbox"]').click()`)
    await delay(100)
    await evaluate(`Array.from(document.querySelectorAll('[role="listbox"] button')).find(e=>e.textContent.trim()==='Actions').click()`)
    await delay(700)
    await check('category switches to Actions', `document.querySelectorAll('.spells-page section').length===1 && /Actions/.test(document.querySelector('.spells-page section button[aria-expanded]').textContent)`)
    await evaluate(`document.querySelector('.spells-toolbar button[aria-haspopup="listbox"]').click()`)
    await delay(100)
    await evaluate(`Array.from(document.querySelectorAll('[role="listbox"] button')).find(e=>e.textContent.trim()==='Spells').click()`)
    await delay(700)
    await check('full spell catalog restored', `document.querySelectorAll('[data-deferred-spell-card]').length===1139`)
    await evaluate(`document.querySelector('.spells-page .polyhedron-scroll').scrollTop=0`)
    for (let i=0;i<50;i++) {
      const pending = await evaluate(`Array.from(document.querySelectorAll('[data-deferred-spell-card="pending"]')).filter(e=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth}).length`)
      if (!pending) break
      await delay(100)
    }
    await check('no visible cards remain skeletons after category change', `Array.from(document.querySelectorAll('[data-deferred-spell-card="pending"]')).every(e=>{const r=e.getBoundingClientRect();return r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth})`)
    await delay(1000)
    console.log(JSON.stringify({ stage:'regression-checks', checks }))
  }
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))`)
  wc.debugger.detach()
  const output = translate ? (optimized ? 'tab-ui-translate-optimized' : 'tab-ui-translate-baseline') : (optimized ? 'tab-ui-results-optimized' : 'tab-ui-results')
  await fs.writeFile(path.join(root,output+'.json'), JSON.stringify({project:project.name,sessionRows:saved.length,method:'Built production renderer in hidden unthrottled Electron window; isolated copied profile; click-to-two-animation-frames after rows; complete = fonts ready, visible images finished, network idle and DOM quiet for 500ms. Deferred offscreen contents are not part of initial completion.',window:win.getSize(),initialTranslate,measurements,checks},null,2))
  await fs.writeFile(path.join(root,translate ? output+'.png' : optimized ? 'tab-ui-spells-optimized.png' : 'tab-ui-spells.png'), await win.capturePage().then(image=>image.toPNG()))
  clearTimeout(timeout)
  console.log('UI benchmark completed; originals untouched; test profile: ' + testProfile)
  app.exit(0)
}
prepare().catch(error=> { console.error(error.stack); clearTimeout(timeout); app.exit(1) })
