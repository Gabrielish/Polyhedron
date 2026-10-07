param([Parameter(Mandatory=$true)][string]$IconPath)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PolyhedronIconLoader {
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern IntPtr LoadImageW(IntPtr instance, string path, uint type, int width, int height, uint flags);
  [DllImport("user32.dll")]
  public static extern bool DestroyIcon(IntPtr icon);
}
'@
foreach ($size in @(16, 32, 48, 256)) {
  $icon = [PolyhedronIconLoader]::LoadImageW([IntPtr]::Zero, $IconPath, 1, $size, $size, 0x10)
  if ($icon -eq [IntPtr]::Zero) { throw "Windows rejected ICO at ${size}px: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
  [void][PolyhedronIconLoader]::DestroyIcon($icon)
  Write-Output "PASS: native Windows ICO load at ${size}px"
}
