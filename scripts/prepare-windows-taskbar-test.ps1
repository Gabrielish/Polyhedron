$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $root 'dist\Polyhedron Icon Test.lnk'))
$runtimeRoot = Join-Path 'C:\Users\gabriel\AppData\Local\Temp' 'polyhedron-taskbar-test-runtime'
if (!(Test-Path -LiteralPath (Join-Path $runtimeRoot 'electron.exe'))) {
  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
  Copy-Item -Path (Join-Path $root 'dist\icon-loader-test\electron\*') -Destination $runtimeRoot -Recurse
}
$shortcut.TargetPath = Join-Path $runtimeRoot 'electron.exe'
$shortcut.Arguments = '"' + (Join-Path $root 'scripts\windows-taskbar-fixture.cjs') + '"'
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = (Join-Path $root 'build\icon.ico') + ',0'
$shortcut.Save()
Write-Output 'Prepared isolated test shortcut in dist.'
