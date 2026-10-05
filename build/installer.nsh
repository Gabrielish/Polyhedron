; React/Electron handles the visible installer. electron-builder's NSIS engine
; still owns extraction, upgrades, shortcuts, registration and uninstalling.
!include LogicLib.nsh
!ifdef BUILD_UNINSTALLER
  !include "${BUILD_RESOURCES_DIR}\legacy-installer-theme.nsh"
!else
  !ifndef POLYHEDRON_UI_ARCHIVE
    !define POLYHEDRON_UI_ARCHIVE "${BUILD_RESOURCES_DIR}\setup-ui.7z"
  !endif
  Var PolyhedronUiHandle
  Var PolyhedronUiPid
  Var PolyhedronUiEnabled
  Var PolyhedronWaitTicks
  Var PolyhedronSplashLibrary
  Var PolyhedronSplashHide

  Function PolyhedronHideSplash
    ${If} $PolyhedronSplashHide != 0
      System::Call '::$PolyhedronSplashHide()'
      StrCpy $PolyhedronSplashHide 0
    ${EndIf}
  FunctionEnd

  Function PolyhedronWaitForUi
    ${If} $PolyhedronUiHandle != 0
      ${Do}
        System::Call 'kernel32::WaitForSingleObject(p $PolyhedronUiHandle, i 100) i.r0'
      ${LoopWhile} $0 == 258
      System::Call 'kernel32::CloseHandle(p $PolyhedronUiHandle)'
      StrCpy $PolyhedronUiHandle 0
      StrCpy $PolyhedronSplashHide 0
    ${EndIf}
  FunctionEnd

  !macro customHeader
    Function .onInstSuccess
      ${If} $PolyhedronUiEnabled == 1
        WriteINIStr "$PLUGINSDIR\status.ini" "installer" "target" "$INSTDIR"
        WriteINIStr "$PLUGINSDIR\status.ini" "installer" "state" "done"
        Call PolyhedronWaitForUi
      ${EndIf}
    FunctionEnd
    Function .onInstFailed
      ${If} $PolyhedronUiEnabled == 1
        WriteINIStr "$PLUGINSDIR\status.ini" "installer" "state" "error"
        Call PolyhedronWaitForUi
      ${EndIf}
    FunctionEnd
  !macroend

  !macro customInit
    ; Silent updates and automated installations retain their existing behavior.
    ${IfNot} ${Silent}
      StrCpy $PolyhedronUiEnabled 1
      StrCpy $PolyhedronUiHandle 0
      InitPluginsDir
      File "/oname=$PLUGINSDIR\PolyhedronSplash.dll" "${BUILD_RESOURCES_DIR}\installer-theme\PolyhedronSplash.dll"
      File "/oname=$PLUGINSDIR\splash.ico" "${BUILD_RESOURCES_DIR}\icon.ico"
      System::Call 'kernel32::LoadLibraryW(w "$PLUGINSDIR\PolyhedronSplash.dll") p.s'
      Pop $PolyhedronSplashLibrary
      ${If} $PolyhedronSplashLibrary != 0
        System::Call 'kernel32::GetProcAddress(p $PolyhedronSplashLibrary, m "HideSplash") p.s'
        Pop $PolyhedronSplashHide
        System::Call 'kernel32::GetProcAddress(p $PolyhedronSplashLibrary, m "ShowSplash") p.r0'
        ${If} $0 != 0
          System::Call '::$0(w "$PLUGINSDIR\splash.ico")'
        ${EndIf}
      ${EndIf}
      ; A UTF-16 BOM makes Windows' INI API preserve Unicode user/folder names.
      FileOpen $0 "$PLUGINSDIR\status.ini" w
      FileWriteByte $0 255
      FileWriteByte $0 254
      FileWriteUTF16LE $0 "[installer]$\r$\n"
      FileClose $0
      WriteINIStr "$PLUGINSDIR\status.ini" "installer" "state" "ready"
      WriteINIStr "$PLUGINSDIR\status.ini" "installer" "target" "$INSTDIR"
      System::Call 'kernel32::GetCurrentProcessId() i.r0'
      WriteINIStr "$PLUGINSDIR\status.ini" "installer" "pid" "$0"
      SetOutPath "$PLUGINSDIR\ui"
      SetCompress off
      File "/oname=$PLUGINSDIR\setup-ui.7z" "${POLYHEDRON_UI_ARCHIVE}"
      SetCompress auto
      Nsis7z::Extract "$PLUGINSDIR\setup-ui.7z"
      Delete "$PLUGINSDIR\setup-ui.7z"
      ; Do not let the normal app-running check identify Setup as Polyhedron.
      Rename "$PLUGINSDIR\ui\${APP_EXECUTABLE_FILENAME}" "$PLUGINSDIR\ui\PolyhedronSetupUI.exe"
      ClearErrors
      Exec '"$PLUGINSDIR\ui\PolyhedronSetupUI.exe" --polyhedron-installer "--installer-job-dir=$PLUGINSDIR"'
      ${If} ${Errors}
        Call PolyhedronHideSplash
        MessageBox MB_OK|MB_ICONSTOP "Unable to start Polyhedron Setup. Please run the installer again."
        Abort
      ${EndIf}
      StrCpy $PolyhedronWaitTicks 0
      ${Do}
        ReadINIStr $PolyhedronUiPid "$PLUGINSDIR\request.ini" "installer" "pid"
        ${If} $PolyhedronUiPid != ""
        ${AndIf} $PolyhedronUiHandle == 0
          System::Call 'kernel32::OpenProcess(i 0x00100000, i 0, i $PolyhedronUiPid) p.s'
          Pop $PolyhedronUiHandle
          ${If} $PolyhedronUiHandle == 0
            Call PolyhedronHideSplash
            Abort
          ${EndIf}
        ${EndIf}
        ${If} $PolyhedronUiHandle != 0
          System::Call 'kernel32::WaitForSingleObject(p $PolyhedronUiHandle, i 0) i.r0'
          ${If} $0 != 258
            Call PolyhedronHideSplash
            System::Call 'kernel32::CloseHandle(p $PolyhedronUiHandle)'
            Abort
          ${EndIf}
        ${Else}
          IntOp $PolyhedronWaitTicks $PolyhedronWaitTicks + 1
          ${If} $PolyhedronWaitTicks > 600
            Call PolyhedronHideSplash
            MessageBox MB_OK|MB_ICONSTOP "Polyhedron Setup did not start. Please run the installer again."
            Abort
          ${EndIf}
        ${EndIf}
        ReadINIStr $0 "$PLUGINSDIR\request.ini" "installer" "command"
        ${If} $0 == "visible"
          Call PolyhedronHideSplash
        ${EndIf}
        ${If} $0 == "cancel"
          Call PolyhedronHideSplash
          Call PolyhedronWaitForUi
          Abort
        ${EndIf}
        ${If} $0 == "start"
          Call PolyhedronHideSplash
          ReadINIStr $R4 "$PLUGINSDIR\request.ini" "installer" "target"
          StrCmp $R4 "" 0 +2
          Abort
          !insertmacro setInstallModePerUser
          StrCpy $INSTDIR $R4
          WriteINIStr "$PLUGINSDIR\status.ini" "installer" "target" "$INSTDIR"
          WriteINIStr "$PLUGINSDIR\status.ini" "installer" "state" "installing"
          SetOutPath "$INSTDIR"
          SetSilent silent
          ${Break}
        ${EndIf}
        Sleep 100
      ${Loop}
    ${EndIf}
  !macroend
!endif
