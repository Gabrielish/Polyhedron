// Keep installation isolated from the application's database and services.
if (process.argv.includes('--polyhedron-installer') || process.argv.includes('--installer-preview')) {
  void import('./installer').then(({ startInstaller }) => startInstaller())
} else {
  void import('./application')
}
