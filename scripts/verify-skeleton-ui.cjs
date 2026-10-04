const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const { createRequire } = require('node:module')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { clsx } = require('clsx')
const { twMerge } = require('tailwind-merge')
const root = path.resolve(__dirname, '..')
let phase = 'loaded'
let view = 'cards'
async function run() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-skeleton-ui-'))
  app.setPath('userData', profile)
  await app.whenReady()
  const source = await fs.readFile(
    path.join(root, 'src/renderer/src/components/layout/RouteLoadingSkeleton.tsx'),
    'utf8'
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === '@/context/TranslationSession')
        return { useTranslationSession: () => ({ phase }) }
      if (name === '@/lib/utils') return { cn: (...args) => twMerge(clsx(args)) }
      return require(name)
    },
    localStorage: { getItem: () => JSON.stringify({ view }) }
  })
  const cssPath = path.join(root, 'src/renderer/src/assets/main.css')
  const { compile } = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const compiler = await compile(await fs.readFile(cssPath, 'utf8'), {base:path.dirname(cssPath),onDependency:()=>{}})
  const css = compiler.build([...new Set(source.split(/[\s"'`{}]+/))])
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 940,
    webPreferences: { backgroundThrottling: false }
  })
  const routes = [
    '/translate',
    '/consistency',
    '/dialogues',
    '/game-data',
    '/spells',
    '/workspace',
    '/settings'
  ]
  const shots = []
  for (const width of [1600, 600]) {
    win.setContentSize(width, 900)
    for (const route of routes) {
      const markup = renderToStaticMarkup(
        React.createElement(exports.RouteLoadingSkeleton, { pathname: route })
      )
      assert.ok(markup.includes('role="status"'))
      assert.ok(!/<button|<input|<textarea/.test(markup))
      assert.ok(!markup.includes('glow'))
      const html = `<!doctype html><html data-theme="liquid-glass"><head><meta charset="utf-8"><style>${css}</style><style>*{animation:none!important}html,body{margin:0;width:100%;height:100%;--poly-accent:#8c52ff}.app-content-shell{width:100%;height:100%}</style></head><body><div class="app-content-shell">${markup}</div></body></html>`
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      const themed = await win.webContents.executeJavaScript(`(()=>{
        const frame=document.querySelector('[data-route-skeleton]');
        const block=frame.querySelector('.app-skeleton-block');
        const color=()=>getComputedStyle(block).backgroundColor;
        const before=color();document.documentElement.style.setProperty('--poly-accent','#A7F175');document.body.style.setProperty('--poly-accent','#A7F175');const after=color();
        const surfaces=Array.from(frame.querySelectorAll('[class*="bg-[#"]:not(.app-skeleton-block):not(.app-loading-skeleton)')).map(e=>getComputedStyle(e).backgroundColor);
        return {frame:getComputedStyle(frame).backgroundColor,before,after,surfaces};
      })()`)
      assert.equal(themed.frame,'rgb(5, 5, 5)',route+' theme background')
      assert.equal(themed.before,themed.after,route+' placeholders must stay neutral when accent changes')
      assert.equal(themed.after,'rgb(38, 38, 38)',route+' neutral graphite placeholders')
      assert.ok(themed.surfaces.every(color=>['rgb(16, 16, 16)','rgb(41, 41, 41)'].includes(color)),route+' fixed blue loading surface: '+JSON.stringify(themed.surfaces))
      const geometry = await win.webContents.executeJavaScript(`(() => {
        const frame=document.querySelector('[data-route-skeleton]');const searches=[...document.querySelectorAll('[data-skeleton-search]')];
        return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,frameHeight:frame.getBoundingClientRect().height,
          badSearch:searches.some(el=>el.getBoundingClientRect().width<80),searchTops:searches.map(el=>el.getBoundingClientRect().top),nodes:document.querySelectorAll('*').length};
      })()`)
      assert.ok(
        geometry.scrollWidth <= geometry.width + 1,
        route + ' horizontal overflow ' + JSON.stringify(geometry)
      )
      assert.ok(geometry.frameHeight > 100, route + ' empty frame')
      assert.ok(!geometry.badSearch, route + ' collapsed search')
      if (route === '/dialogues' && width > 1024)
        assert.ok(
          Math.abs(geometry.searchTops[0] - geometry.searchTops[1]) < 1,
          'Dialogue desktop search bars should share a row'
        )
      if (width === 1600) {
        const image = await win.capturePage()
        shots.push({ route, data: image.toDataURL() })
      }
      console.log(JSON.stringify({ route, ...geometry }))
    }
  }
  view = 'list'
  let markup = renderToStaticMarkup(
    React.createElement(exports.RouteLoadingSkeleton, { pathname: '/spells' })
  )
  assert.ok(markup.includes('data-skeleton-spells-view="list"'))
  assert.ok(!markup.includes('2xl:grid-cols-4'))
  phase = 'idle'
  markup = renderToStaticMarkup(
    React.createElement(exports.RouteLoadingSkeleton, { pathname: '/translate' })
  )
  assert.ok(markup.includes('Translate setup'))
  for (const route of ['/consistency', '/dialogues', '/game-data', '/spells'])
    assert.ok(
      renderToStaticMarkup(
        React.createElement(exports.RouteLoadingSkeleton, { pathname: route })
      ).includes('data-route-skeleton="Reference"')
    )
  const sheet = `<html><body style="margin:0;background:#111;color:#ddd;font:18px Arial;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:12px">${shots.map((shot) => `<div>${shot.route}<img src="${shot.data}" style="display:block;width:100%"></div>`).join('')}</body></html>`
  win.setContentSize(1600, 2100)
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(sheet))
  const output = path.join(profile, 'skeleton-contact-sheet.png')
  await fs.writeFile(output, (await win.capturePage()).toPNG())
  console.log(
    'Skeleton UI: all routes, desktop/narrow layout, saved list view, setup/idle states and accessibility passed; ' +
      output
  )
  app.exit(0)
}
run().catch((error) => {
  console.error(error.stack)
  app.exit(1)
})
