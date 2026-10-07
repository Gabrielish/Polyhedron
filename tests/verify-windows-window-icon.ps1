param(
  [Parameter(Mandatory=$true)][string]$WindowHandle,
  [Parameter(Mandatory=$true)][string]$IconPath,
  [string]$AppId = 'com.polyhedron.taskbar-test'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)] public struct IconPropertyKey { public Guid format; public uint id; }
[StructLayout(LayoutKind.Explicit, Size=24)] public struct IconPropVariant {
  [FieldOffset(0)] public ushort type;
  [FieldOffset(8)] public IntPtr value;
}
[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IconPropertyStore {
  [PreserveSig] int GetCount(out uint count);
  [PreserveSig] int GetAt(uint index, out IconPropertyKey key);
  [PreserveSig] int GetValue(ref IconPropertyKey key, out IconPropVariant value);
  [PreserveSig] int SetValue(ref IconPropertyKey key, ref IconPropVariant value);
  [PreserveSig] int Commit();
}
public static class WindowIconProbe {
  [DllImport("shell32.dll")] static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IconPropertyStore store);
  [DllImport("ole32.dll")] static extern int PropVariantClear(ref IconPropVariant value);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
  public static string Property(IntPtr hwnd, uint id) {
    Guid iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
    IconPropertyStore store;
    Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(hwnd, ref iid, out store));
    try {
      IconPropertyKey key = new IconPropertyKey { format = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), id = id };
      IconPropVariant value;
      Marshal.ThrowExceptionForHR(store.GetValue(ref key, out value));
      try { return value.type == 31 ? Marshal.PtrToStringUni(value.value) : null; }
      finally { PropVariantClear(ref value); }
    } finally { Marshal.ReleaseComObject(store); }
  }
}
'@
$hwnd = [IntPtr]::new([long]::Parse($WindowHandle))
if ([WindowIconProbe]::Property($hwnd, 5) -ne $AppId) { throw 'Window AppUserModelID was not applied.' }
if ([WindowIconProbe]::Property($hwnd, 3) -ne ($IconPath + ',0')) { throw 'Window relaunch icon does not match the selected artwork.' }
if (![WindowIconProbe]::Property($hwnd, 2) -or ![WindowIconProbe]::Property($hwnd, 4)) { throw 'Window relaunch metadata is incomplete.' }
foreach ($size in @(0, 1)) {
  $handle = [WindowIconProbe]::SendMessage($hwnd, 0x7F, [IntPtr]::new($size), [IntPtr]::Zero)
  if ($handle -eq [IntPtr]::Zero) { throw 'WM_GETICON returned an empty native icon.' }
  $bitmap = [Drawing.Icon]::FromHandle($handle).ToBitmap()
  try {
    $color = $bitmap.GetPixel([int]($bitmap.Width / 2), [int]($bitmap.Height * 0.16))
    if ($color.R -lt 150 -or $color.R -lt ($color.G * 2) -or $color.R -lt ($color.B * 2)) {
      throw "Native window icon did not turn red: $color"
    }
    Write-Output "PASS: native Windows icon size $($bitmap.Width), red selected surface"
  } finally { $bitmap.Dispose() }
}
Write-Output 'PASS: Windows window identity, relaunch icon, and relaunch command/display name'
