Unicode true
Name "Polyhedron protocol regression fixture"
OutFile "${TEST_EXE}"
RequestExecutionLevel user
!include LogicLib.nsh
!addplugindir /x86-unicode "${TEST_PLUGINS}"
!define APP_EXECUTABLE_FILENAME "Polyhedron.exe"
!define POLYHEDRON_UI_ARCHIVE "${APP_64}"
!macro setInstallModePerUser
  SetShellVarContext current
!macroend
!include "${BUILD_RESOURCES_DIR}/installer.nsh"
!insertmacro customHeader
Function .onInit
  StrCpy $INSTDIR "$TEMP\Polyhedron-protocol-silent\Polyhedron"
  !insertmacro customInit
FunctionEnd
Section
  SetOutPath "$INSTDIR"
  FileOpen $0 "$INSTDIR\installed.marker" w
  FileWrite $0 "Protocol fixture only; no application installed."
  FileClose $0
  Sleep 300
SectionEnd
