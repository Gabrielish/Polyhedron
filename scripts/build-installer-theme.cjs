// The NSIS wizard is a 32-bit process even when installing the x64 app.
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
execFileSync('i686-w64-mingw32-gcc', [
  '-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', '-shared', '-nostdlib', '-fno-builtin',
  '-Wl,--kill-at,--entry,_DllMain@12', '-o', path.join(root, 'resources/installer/installer-theme/PolyhedronTheme.dll'),
  path.join(root, 'resources/installer/installer-theme/theme.c'), '-lcomctl32', '-luxtheme', '-ldwmapi', '-lgdi32', '-luser32', '-lkernel32'
], { stdio: 'inherit' })
const imports = execFileSync('i686-w64-mingw32-objdump', [
  '-p', path.join(root, 'resources/installer/installer-theme/PolyhedronTheme.dll')
], { encoding: 'utf8' })
const allowed = new Set(['comctl32.dll', 'dwmapi.dll', 'gdi32.dll', 'kernel32.dll', 'user32.dll', 'uxtheme.dll'])
for (const [, name] of imports.matchAll(/DLL Name:\s*(\S+)/g)) {
  if (!allowed.has(name.toLowerCase())) throw new Error(`Unexpected installer runtime dependency: ${name}`)
}
if (!imports.includes('ApplyTheme')) throw new Error('Installer theme entry point missing')
if (/\sGetWindowSubclass(?:\s|$)/.test(imports)) {
  throw new Error('Do not import GetWindowSubclass by name: the NSIS common-controls library does not export it')
}
console.log('Built the native dark installer theme (x86 DLL, no extra runtime dependency).')
