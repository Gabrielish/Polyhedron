const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

let checked = 0
const failures = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (entry.name.endsWith('.tsx')) audit(file)
  }
}
function audit(file) {
  const text = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const icons = new Set()
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === 'lucide-react') {
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) icons.add(item.name.text)
    }
  }
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'button') {
      const attrs = node.openingElement.attributes.getText(source)
      const solid = /btnPrimary|accent-solid-|bg-amber-500(?!\/[0-8])|bg-\[var\(--poly-accent/.test(attrs)
      // Toggles and selected counter/status controls are not labeled solid actions.
      if (solid && !/role="switch"|aria-checked/.test(attrs)) {
        const content = node.children.map(child => child.getText(source)).join(' ')
        const label = content.replace(/<[^>]*>/g, '').trim()
        if (label && !file.endsWith('SimilaritySettingsCard.tsx') && !file.endsWith('TranslationGrid.tsx')) {
          const used = [...icons].filter(icon => new RegExp('<' + icon + '(?:\\s|/|>)').test(content))
          if (!used.length) failures.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: no icon`)
          if (used.length && used.every(icon => /Loader/.test(icon))) failures.push(file + ': idle action only has a loading spinner')
          checked++
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
walk(path.join(__dirname, '../src/renderer/src'))
if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
console.log(`PASS: ${checked} labeled solid-accent action definitions have icons (including idle/loading branches)`)
