const assert = require('node:assert/strict')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')

async function run() {
  const root = path.resolve(__dirname, '..')
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({
    entryPoints: [path.join(root, 'src/renderer/src/hooks/useSpellsViewMemory.ts')],
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react']
  })
  let element
  let cleanup
  let resize
  const listeners = new Map()
  const module = { exports: {} }
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports,
    require: () => ({
      useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
      useRef: () => ({ current: element }),
      useLayoutEffect: effect => { cleanup = effect() }
    }),
    ResizeObserver: class {
      constructor(callback) { resize = callback }
      observe() {}
      disconnect() {}
    },
    document: {
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: name => listeners.delete(name)
    }
  })
  const { getSpellsViewMemory, useSpellsRememberedState, useSpellsRememberedScroll } = module.exports
  const a = getSpellsViewMemory('project-a|en|ro')
  a.values.set('selected', 'Fireball')
  assert.equal(useSpellsRememberedState(a, 'selected', null)[0], 'Fireball')
  assert.equal(useSpellsRememberedState(getSpellsViewMemory('project-b|en|ro'), 'selected', null)[0], null)
  assert.equal(getSpellsViewMemory('project-a|en|ro'), a)

  let extraHeight = 0
  element = {
    scrollTop: 0,
    firstElementChild: {},
    getBoundingClientRect: () => ({ top: 0 }),
    querySelectorAll: () => Array.from({ length: 40 }, (_, index) => ({
      dataset: { spellKey: `spell-${index}` },
      getBoundingClientRect: () => ({
        top: index * 100 + (index ? extraHeight : 0) - element.scrollTop,
        bottom: (index + 1) * 100 + extraHeight - element.scrollTop
      })
    }))
  }
  useSpellsRememberedScroll(a, 'catalog')
  element.scrollTop = 1505
  cleanup()
  assert.equal(a.scroll.get('catalog').anchor, 'spell-15')
  assert.equal(a.scroll.get('catalog').offset, -5)
  element.scrollTop = 0
  extraHeight = 200
  useSpellsRememberedScroll(a, 'catalog')
  assert.equal(element.scrollTop, 1705, 'Restore same visible card after deferred heights change')
  extraHeight = 400
  resize()
  assert.equal(element.scrollTop, 1905, 'Follow deferred layout changes')
  listeners.get('pointerdown')()
  element.scrollTop = 999
  resize()
  assert.equal(element.scrollTop, 999, 'Never fight user scrolling')
  cleanup()
  assert.equal(listeners.size, 0)
  assert.equal(a.scroll.get('catalog').top, 999)
  console.log('PASS: retained selection, project isolation, scroll anchor, deferred resize, user input, cleanup')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
