const {execFileSync} = require('node:child_process')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
execFileSync('i686-w64-mingw32-gcc', [
  '-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', '-shared', '-nostdlib', '-fno-builtin',
  '-Wl,--kill-at,--entry,_DllMain@12', '-o', path.join(root, 'build/installer-theme/PolyhedronSplash.dll'),
  path.join(root, 'build/installer-theme/splash.c'), '-lgdi32', '-luser32', '-lkernel32'
], {stdio:'inherit'})
