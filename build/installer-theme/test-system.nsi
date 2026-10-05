; Hidden integration test of NSIS System.dll calling the native theme.
Name "Polyhedron theme integration test"
Unicode true
OutFile "../../dist/installers-preview/installer-theme-system-test.exe"
SilentInstall silent
RequestExecutionLevel user
Section
  InitPluginsDir
  File "/oname=$PLUGINSDIR\PolyhedronTheme.dll" "PolyhedronTheme.dll"
  System::Call 'kernel32::LoadLibraryW(w "$PLUGINSDIR\PolyhedronTheme.dll") p.r0'
  System::Call 'kernel32::GetProcAddress(p r0, m "ApplyTheme") p.r1'
  System::Call 'user32::CreateWindowExW(i 0, w "#32770", w "Hidden theme test", i 0, i 0, i 0, i 200, i 100, p 0, p 0, p 0, p 0) p.r3'
  System::Call '::$1(p r3) i.r2'
  FileOpen $4 "$TEMP\Polyhedron-theme-system-test.txt" w
  FileWrite $4 "Direct export call status: $2$\r$\n"
  System::Call '"$PLUGINSDIR\PolyhedronTheme.dll"::ApplyTheme(p r3) i.r2'
  FileWrite $4 "Named DLL call status: $2$\r$\n"
  System::Call 'user32::DestroyWindow(p r3)'
  FileClose $4
SectionEnd
