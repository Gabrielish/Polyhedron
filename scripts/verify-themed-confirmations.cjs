const fs=require('node:fs/promises')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const {createRequire}=require('node:module')
const {transform}=createRequire(require.resolve('vite/package.json'))('esbuild')

async function handlers(file,names,context){
  const source=await fs.readFile(file,'utf8')
  if(source.includes('window.confirm('))throw new Error('Native confirmation remains: '+file)
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const declarations=[]
  const visit=node=>{
    if(ts.isVariableDeclaration(node)&&names.includes(node.name.getText(ast)))
      declarations.push('globalThis.'+node.name.getText(ast)+' = '+node.initializer.getText(ast))
    ts.forEachChild(node,visit)
  }
  visit(ast)
  if(declarations.length!==names.length)throw new Error('Missing confirmation handlers')
  const code=await transform(declarations.join('\n'),{loader:'ts'})
  vm.runInContext(code.code,context)
}
async function run(){
  const base=path.resolve(__dirname,'../src/renderer/src/pages')
  const calls=[]
  const workspace=vm.createContext({pendingImportPath:null,window:{api:{fs:{openDialog:async()=>['fixture.pws']},workspace:{import:async args=>{calls.push(args);return {stats:{total:2,translated:1},backupPath:'fixture.backup'}}}}},setRunning:()=>{},setMessage:()=>{},setMessageError:()=>{},setImportedStats:()=>{},toast:{error:message=>{throw new Error(message)}}})
  workspace.setPendingImportPath=value=>{workspace.pendingImportPath=value}
  await handlers(path.join(base,'WorkspacePage.tsx'),['importWorkspace','confirmImportWorkspace'],workspace)
  await workspace.importWorkspace()
  if(calls.length||workspace.pendingImportPath!=='fixture.pws')throw new Error('Import ran before confirmation')
  workspace.setPendingImportPath(null)
  await workspace.confirmImportWorkspace()
  if(calls.length)throw new Error('Cancelled import still ran')
  await workspace.importWorkspace()
  await workspace.confirmImportWorkspace()
  if(calls.length!==1||calls[0].inputPath!=='fixture.pws'||workspace.pendingImportPath!==null)throw new Error('Confirmed import failed')
  console.log('PASS: workspace import waits for confirmation; cancel performs no import; confirm imports once')
  const writes=[],manual=[]
  const consistency=vm.createContext({pendingVariant:null,session:{updateEntry:(id,value)=>writes.push([id,value]),markManual:id=>manual.push(id)}})
  consistency.setPendingVariant=value=>{consistency.pendingVariant=value}
  await handlers(path.join(base,'ConsistencyPage.tsx'),['applyVariant','confirmApplyVariant'],consistency)
  const group={total:2,variants:[{entries:[{rowId:'a',target:'old'},{rowId:'b',target:'chosen'}]}]},variant={value:'chosen'}
  consistency.applyVariant(group,variant)
  if(writes.length)throw new Error('Variant applied before confirmation')
  consistency.setPendingVariant(null)
  consistency.confirmApplyVariant()
  if(writes.length)throw new Error('Cancelled variant still applied')
  consistency.applyVariant(group,variant)
  consistency.confirmApplyVariant()
  if(JSON.stringify(writes)!=='[["a","chosen"]]'||JSON.stringify(manual)!=='["a"]'||consistency.pendingVariant!==null)throw new Error('Confirmed variant wrote wrong entries')
  console.log('PASS: consistency apply waits for confirmation; cancel performs no edits; confirm preserves original update semantics')
}
run().catch(error=>{console.error(error);process.exitCode=1})
