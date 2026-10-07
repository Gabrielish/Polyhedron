const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {createRequire} = require('node:module')

async function run() {
  const root=path.resolve(__dirname,'..')
  const {build}=createRequire(require.resolve('vite/package.json'))('esbuild')
  const result=await build({
    absWorkingDir:root,tsconfig:'config/tsconfig.web.json',bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',
    stdin:{resolveDir:root,contents:`
      export {initI18n,i18n} from './src/renderer/src/i18n';
      export {resources} from './src/renderer/src/i18n/resources';
      export {supportedLanguages,isSupportedLanguage} from './src/renderer/src/i18n/languages';
    `}
  })
  const fixture={exports:{}}
  new Function('module','exports','require',result.outputFiles[0].text)(fixture,fixture.exports,require)
  const {initI18n,i18n,resources,supportedLanguages,isSupportedLanguage}=fixture.exports
  assert.deepEqual(supportedLanguages,['en'])
  assert.deepEqual(Object.keys(resources),['en'])
  assert.equal(isSupportedLanguage('pt-BR'),false)
  const config={app_language:'pt-BR'}
  const writes=[]
  global.window={api:{config:{
    getAll:async()=>({...config}),set:async({key,value})=>{config[key]=value;writes.push(key)}
  }}}
  await initI18n()
  assert.equal(i18n.language,'en')
  assert.equal(config.app_language,'en')
  assert.equal(i18n.t('fields.appLanguage',{ns:'settings'}),'Application language')
  assert.equal(i18n.hasResourceBundle('pt-BR','settings'),false)
  await initI18n()
  assert.equal(writes.length,1)
  const settings=fs.readFileSync(path.join(root,'src/renderer/src/pages/SettingsPage.tsx'),'utf8')
  const interfaceStart=settings.indexOf('<SettingsCard title={t(\'sections.interface\')}>')
  const appearance=settings.slice(settings.indexOf('<SettingsCard title="Appearance">'),interfaceStart)
  const interfaceCard=settings.slice(interfaceStart,settings.indexOf('</SettingsCard>',interfaceStart))
  assert.doesNotMatch(appearance,/fields.appLanguage/)
  assert.match(interfaceCard,/fields.appLanguage/)
  assert.doesNotMatch(settings,/SettingsCard title=\{t\('sections.language'\)\}/)
  console.log('PASS: language control is in Interface; English-only resources and options; saved Portuguese preference safely migrates to English.')
}
run().catch(error=>{console.error(error);process.exitCode=1})
