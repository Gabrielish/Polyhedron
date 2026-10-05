param([string]$DllPath = "$PSScriptRoot\PolyhedronTheme.dll")
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ThemeLoader {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr LoadLibraryW(string path);
    [DllImport("kernel32.dll", CharSet = CharSet.Ansi, SetLastError = true)]
    public static extern IntPtr GetProcAddress(IntPtr library, string name);
    [DllImport("kernel32.dll")]
    public static extern bool FreeLibrary(IntPtr library);
}
'@
$library = [ThemeLoader]::LoadLibraryW($DllPath)
if ($library -eq [IntPtr]::Zero) {
    $loadError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $common = [ThemeLoader]::LoadLibraryW('comctl32.dll')
    foreach ($name in @('SetWindowSubclass', 'GetWindowSubclass', 'RemoveWindowSubclass', 'DefSubclassProc')) {
        Write-Output "$name available: $([ThemeLoader]::GetProcAddress($common, $name) -ne [IntPtr]::Zero)"
    }
    [void][ThemeLoader]::FreeLibrary($common)
    throw "Theme DLL load failed: Windows error $loadError"
}
try {
    if ([ThemeLoader]::GetProcAddress($library, 'ApplyTheme') -eq [IntPtr]::Zero) {
        throw 'ApplyTheme export missing'
    }
    Write-Output "PASS: theme loads and ApplyTheme resolves in a $([IntPtr]::Size * 8)-bit Windows process."
} finally {
    [void][ThemeLoader]::FreeLibrary($library)
}
