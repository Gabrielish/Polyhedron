param([ValidateSet('self-test', 'restore-check')][string]$Mode = 'self-test')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$runtimeRoot = Join-Path $env:TEMP 'polyhedron-taskbar-test-runtime'
if (!(Test-Path -LiteralPath (Join-Path $runtimeRoot 'electron.exe'))) {
  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
  Copy-Item -Path (Join-Path $root 'dist\icon-loader-test\electron\*') -Destination $runtimeRoot -Recurse
}
$runtime = Join-Path $runtimeRoot 'electron.exe'
$fixture = Join-Path $root 'tests\windows-taskbar-fixture.cjs'
# Stop only this script's previous automated fixture, never the real app.
Get-CimInstance Win32_Process | Where-Object {
  $_.ExecutablePath -eq $runtime -and $_.CommandLine -like '*windows-taskbar-fixture.cjs*' -and $_.CommandLine -like '*--self-test*'
} | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
$output = Join-Path $root 'dist\icon-loader-test'
$process = Start-Process -FilePath $runtime -ArgumentList ('"' + $fixture + '" --' + $Mode + ' --disable-gpu') -PassThru -RedirectStandardOutput (Join-Path $output ($Mode + '-stdout.txt')) -RedirectStandardError (Join-Path $output ($Mode + '-stderr.txt'))
$processHandle = $process.Handle
if (!$process.WaitForExit(20000)) { $process.Kill(); throw 'Automated Electron taskbar fixture timed out.' }
Get-Content (Join-Path $output ($Mode + '-stdout.txt'))
Get-Content (Join-Path $output ($Mode + '-stderr.txt'))
if ($process.ExitCode -ne 0) { throw "Taskbar fixture failed: $($process.ExitCode)" }
