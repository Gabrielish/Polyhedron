$ErrorActionPreference = 'Stop'
Get-Process -Name 'Polyhedron-1.0.0-windows-x64-setup' -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Output "Installer PID: $($_.Id), started: $($_.StartTime)"
    $_.Modules | Where-Object ModuleName -eq 'PolyhedronTheme.dll' | Select-Object ModuleName, FileName
}
