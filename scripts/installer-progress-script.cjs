// Keep electron-builder's current upgrade/retry logic rather than vendoring its
// installer. Patch only the extraction calls and phase boundaries at build time.
function createInstallerProgressScript(installer, section, extraction) {
  const sectionInclude = '!include "installSection.nsh"'
  const extractionStart = '!macro extractUsing7za FILE'
  const engineInclude = '!include installer.nsh'
  const start = extraction.indexOf(extractionStart)
  const end = extraction.indexOf('!macroend', start)
  if (installer.split(sectionInclude).length !== 2 || section.split(engineInclude).length !== 2 || start < 0 || end < start) {
    throw new Error('NSIS template changed: review installer progress integration before building.')
  }
  let macro = extraction.slice(start, end + '!macroend'.length)
  if (macro.split('Nsis7z::Extract "${FILE}"').length !== 3 || !macro.includes('  DoneExtract7za:') || !macro.includes('  # Retry counter')) {
    throw new Error('NSIS extraction template changed: review progress callbacks before building.')
  }
  macro = macro.replaceAll('Nsis7z::Extract "${FILE}"', [
    '${If} $PolyhedronUiEnabled == 1',
    '    GetFunctionAddress $PolyhedronProgressCallback PolyhedronExtractionProgress',
    '    Nsis7z::ExtractWithCallback "${FILE}" $PolyhedronProgressCallback',
    '  ${Else}',
    '    Nsis7z::Extract "${FILE}"',
    '  ${EndIf}'
  ].join('\n'))
  const phase = (name, progress) => [
    '  ${If} $PolyhedronUiEnabled == 1',
    `    WriteINIStr "$PLUGINSDIR\\status.ini" "installer" "phase" "${name}"`,
    `    WriteINIStr "$PLUGINSDIR\\status.ini" "installer" "progress" "${progress}"`,
    '  ${EndIf}'
  ].join('\n')
  macro = macro.replace('  # Retry counter', phase('copying', 90) + '\n  # Retry counter')
  macro = macro.replace('  DoneExtract7za:', '  DoneExtract7za:\n' + phase('finalizing', 95))
  const patchedSection = section.replace(engineInclude, engineInclude + '\n!macroundef extractUsing7za\n' + macro)
  return installer.replace(sectionInclude, patchedSection)
}
const attached = Symbol('polyhedronInstallerProgress')
function attachInstallerProgress(target, section, extraction) {
  if (target[attached]) return
  const original = target.computeScriptAndSignUninstaller
  if (typeof original !== 'function') throw new Error('NSIS target changed: review installer progress integration before building.')
  // Delegate first: using nsis.script bypasses electron-builder's uninstaller
  // generation/signing. Patch only the returned install script, never its files
  // in node_modules and never the separately compiled uninstaller.
  target.computeScriptAndSignUninstaller = async function (...args) {
    const installer = await original.apply(this, args)
    return createInstallerProgressScript(installer, section, extraction)
  }
  target[attached] = true
}
module.exports = { createInstallerProgressScript, attachInstallerProgress }
