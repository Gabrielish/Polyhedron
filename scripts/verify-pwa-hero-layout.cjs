// Visual layout check against the current public page; no local bundling/build.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
const root = path.resolve(__dirname, '..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'polyhedron-hero-preview-'))
app.setPath('userData', temp)
app.whenReady().then(async () => {
  const css = fs.readFileSync(path.join(root, 'pwa/src/landing.css'), 'utf8').replace(/^@import.*$/gm, '')
  for (const [label, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
    const win = new BrowserWindow({ show: false, width, height, webPreferences: { offscreen: true, backgroundThrottling: false } })
    await win.loadURL('https://gabrielish.github.io/Polyhedron/')
    await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let tries=0;const check=()=>{if(document.querySelector('.lp-hero-preview'))resolve(true);else if(++tries>150)reject(Error('Landing did not render'));else setTimeout(check,100)};check()})`)
    await win.webContents.executeJavaScript(`(()=>{
      const hero=document.querySelector('.lp-hero');
      if(!hero.querySelector('.lp-hero-copy')){
        const copy=document.createElement('div');copy.className='lp-hero-copy';
        const first=hero.querySelector('.lp-eyebrow');hero.insertBefore(copy,first);
        for(const selector of ['.lp-eyebrow','h1','.lp-hero-description','.lp-actions','.lp-platforms'])copy.appendChild(hero.querySelector(selector));
      }
    })()`)
    await win.webContents.insertCSS(css)
    await win.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...[...document.querySelectorAll('.lp-hero img')].map(img=>img.decode().catch(()=>{}))]).then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)))))`)
    const positions = await win.webContents.executeJavaScript(`(()=>{
      const copy=document.querySelector('.lp-hero-copy').getBoundingClientRect();
      const image=document.querySelector('.lp-hero-preview').getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth>innerWidth,sideBySide:copy.right<=image.left&&Math.abs(copy.top-image.top)<250,stacked:image.top>=copy.bottom};
    })()`)
    assert.equal(positions.overflow, false)
    assert.equal(label === 'desktop' ? positions.sideBySide : positions.stacked, true)
    const faq = await win.webContents.executeJavaScript(`(async()=>{
      const button=document.querySelector('.lp-faq-toggle');
      if(!button)throw Error('FAQ toggle missing');
      const visible=()=>[...document.querySelectorAll('.lp-faq details')].filter(el=>el.getClientRects().length).length;
      const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const initial=visible();button.click();await frame();
      const expanded=visible(),more=button.getAttribute('aria-expanded')==='true'&&button.textContent.includes('Show less');
      button.click();await frame();
      return {initial,expanded,collapsed:visible(),more,less:button.getAttribute('aria-expanded')==='false'&&button.textContent.includes('Show more')};
    })()`)
    assert.deepEqual(faq, {initial:3,expanded:9,collapsed:3,more:true,less:true})
    await win.webContents.executeJavaScript('scrollTo(0,0)')
    const connect = await win.webContents.executeJavaScript(`(()=>{
      const link=document.querySelector('.lp-header .lp-nav-connect');
      const box=link.getBoundingClientRect();return {x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)};
    })()`)
    win.webContents.sendInputEvent({type:'mouseMove',...connect})
    await new Promise(resolve=>setTimeout(resolve,300))
    const hover = await win.webContents.executeJavaScript(`(()=>{
      const link=document.querySelector('.lp-header .lp-nav-connect');
      return {glow:getComputedStyle(link).boxShadow!=='none',arrow:getComputedStyle(link.querySelector('svg')).transform!=='none'};
    })()`)
    assert.deepEqual(hover,{glow:true,arrow:true})
    win.webContents.sendInputEvent({type:'mouseMove',x:0,y:0})
    const screenshot = path.join(temp, `hero-${label}.png`)
    fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG())
    console.log(`PASS: ${label} hero, FAQ show more/less and Connect hover; preview ${screenshot}`)
    win.destroy()
  }
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
