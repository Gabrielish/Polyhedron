; Keep electron-builder's installation logic; theme the existing native controls.
!define MUI_BGCOLOR "101010"
!define MUI_TEXTCOLOR "E5E5E5"
!define MUI_DIRECTORYPAGE_BGCOLOR "090909"
!define MUI_INSTFILESPAGE_COLORS "E5E5E5 090909"

!macro PolyhedronNativeTheme PREFIX
  Function ${PREFIX}PolyhedronThemeInit
    Push $0
    Push $1
    Push $2
    InitPluginsDir
    File "/oname=$PLUGINSDIR\PolyhedronTheme.dll" "${BUILD_RESOURCES_DIR}\installer-theme\PolyhedronTheme.dll"
    ; Keep a library reference alive for the lifetime of its window subclasses.
    System::Call 'kernel32::LoadLibraryW(w "$PLUGINSDIR\PolyhedronTheme.dll") p.r0'
    StrCmp $0 0 themeFailed
    System::Call 'kernel32::GetProcAddress(p r0, m "ApplyTheme") p.r1'
    StrCmp $1 0 themeFailed
    ; Call the exact resolved export, rather than System's DLL/name resolver.
    System::Call '::$1(p $HWNDPARENT) i.r2'
    StrCmp $2 1 themeDone
    MessageBox MB_OK|MB_ICONEXCLAMATION "The installer theme could not attach to its window (status $2)."
    Goto themeDone
    themeFailed:
    System::Call 'kernel32::GetLastError() i.r1'
    MessageBox MB_OK|MB_ICONEXCLAMATION "The installer theme could not load (Windows error $1). Installation can continue with standard controls."
    themeDone:
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd
!macroend
!ifdef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.PolyhedronThemeInit
  !insertmacro PolyhedronNativeTheme "un."
!else
  !define MUI_CUSTOMFUNCTION_GUIINIT PolyhedronThemeInit
  !insertmacro PolyhedronNativeTheme ""
!endif
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Polyhedron"
  !define MUI_WELCOMEPAGE_TEXT "Translate and manage your Baldur's Gate 3 localization projects.$\r$\n$\r$\nSetup will install Polyhedron for your Windows account. Existing workspace data is kept."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!ifndef BUILD_UNINSTALLER
  ; Runs immediately before MUI_PAGE_INSTFILES is declared, without adding a
  ; new page or replacing electron-builder's directory validation callback.
  !macro customPageAfterChangeDir
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW PolyhedronProgressShow
  !macroend

  Function PolyhedronProgressShow
    Push $0
    Push $1
    FindWindow $0 "#32770" "" $HWNDPARENT
    GetDlgItem $1 $0 1004
    ; Windows visual styles ignore PBM_SETBARCOLOR. Disable them on this
    ; control only; all other installer controls retain their current style.
    System::Call 'uxtheme::SetWindowTheme(p r1, w "", w "")'
    ; COLORREF is BGR: #A7F175 -> 0x75F1A7.
    SendMessage $1 0x0409 0 0x75F1A7
    ; Match the app's dark input surface behind the accent progress fill.
    SendMessage $1 0x2001 0 0x090909
    Pop $1
    Pop $0
  FunctionEnd
!endif
