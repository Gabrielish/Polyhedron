$ErrorActionPreference = 'Stop'
$output = Join-Path $env:TEMP 'polyhedron-installer-protocol-result.txt'
$target = Join-Path $env:TEMP ('Polyhedron-protocol-' + [char]0x0219 + '\Polyhedron')
$fixture = '\\Mac\Home\Documents\Codex\Polyhedron\dist\installer-protocol-test\protocol-test.exe'
foreach ($mode in @('start', 'cancel', 'crash')) {
  $env:POLYHEDRON_FIXTURE_MODE = $mode
  $env:POLYHEDRON_FIXTURE_RESULT = $output
  if (Test-Path $output) { Remove-Item -LiteralPath $output }
  $marker = Join-Path $target 'installed.marker'
  if (Test-Path $marker) { Remove-Item -LiteralPath $marker }
  $process = Start-Process -FilePath $fixture -PassThru
  if (-not $process.WaitForExit(45000)) { throw "Timed out: $mode" }
  if ($mode -eq 'start') {
    if (-not (Test-Path $marker)) { throw 'Installation section did not run' }
    if ((Get-Content -LiteralPath $output -Raw) -ne 'PASS') { throw 'Completion or Unicode path failed' }
  } else {
    if (Test-Path $marker) { throw "Installation ran after $mode" }
    if ($mode -eq 'cancel' -and (Get-Content -LiteralPath $output -Raw) -ne 'PASS') { throw 'Cancel handshake failed' }
  }
  Write-Output "PASS: NSIS $mode handshake"
}
$env:POLYHEDRON_FIXTURE_MODE = 'start'
if (Test-Path $output) { Remove-Item -LiteralPath $output }
$silent = Start-Process -FilePath $fixture -ArgumentList '/S' -PassThru
if (-not $silent.WaitForExit(10000)) { throw 'Silent mode timed out' }
if (Test-Path $output) { throw 'Silent installation launched the UI' }
if (-not (Test-Path (Join-Path $env:TEMP 'Polyhedron-protocol-silent\Polyhedron\installed.marker'))) { throw 'Silent installation section did not run' }
Write-Output 'PASS: silent updates bypass UI'
