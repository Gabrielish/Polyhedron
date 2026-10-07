// Headless stand-in for the UI: tests the real NSIS bridge without installing
// Polyhedron, registering it, or interacting with the user's desktop.
#include <windows.h>
#include <shellapi.h>

void WINAPI TestEntry(void) {
  int argc = 0;
  LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  WCHAR job[MAX_PATH] = L"", status[MAX_PATH], request[MAX_PATH], result[MAX_PATH];
  WCHAR mode[32], target[MAX_PATH], state[32], pid[32];
  for (int i = 0; i < argc; i++)
    if (wcsncmp(argv[i], L"--installer-job-dir=", 20) == 0) lstrcpyW(job, argv[i] + 20);
  LocalFree(argv);
  GetEnvironmentVariableW(L"POLYHEDRON_FIXTURE_MODE", mode, 32);
  GetEnvironmentVariableW(L"POLYHEDRON_FIXTURE_RESULT", result, MAX_PATH);
  wsprintfW(status, L"%s\\status.ini", job);
  wsprintfW(request, L"%s\\request.ini", job);
  GetTempPathW(MAX_PATH, target);
  lstrcatW(target, L"Polyhedron-protocol-\x0219\\Polyhedron");
  HANDLE ini = CreateFileW(request, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
  WORD bom = 0xfeff; DWORD written;
  WriteFile(ini, &bom, 2, &written, NULL); CloseHandle(ini);
  wsprintfW(pid, L"%lu", GetCurrentProcessId());
  WritePrivateProfileStringW(L"installer", L"pid", pid, request);
  WritePrivateProfileStringW(L"installer", L"command", L"ready", request);
  Sleep(300);
  // The production native splash must exist before the frontend is visible.
  if (!FindWindowW(L"PolyhedronSetupSplash", L"Polyhedron Setup")) ExitProcess(4);
  WritePrivateProfileStringW(L"installer", L"command", L"visible", request);
  Sleep(300);
  if (FindWindowW(L"PolyhedronSetupSplash", L"Polyhedron Setup")) ExitProcess(5);
  if (lstrcmpW(mode, L"crash") == 0) ExitProcess(0);
  if (lstrcmpW(mode, L"cancel") == 0) {
    WritePrivateProfileStringW(L"installer", L"command", L"cancel", request);
    Sleep(300);
  } else {
    WritePrivateProfileStringW(L"installer", L"target", target, request);
    WritePrivateProfileStringW(L"installer", L"command", L"start", request);
    for (int i = 0; i < 300; i++) {
      GetPrivateProfileStringW(L"installer", L"state", L"", state, 32, status);
      if (lstrcmpW(state, L"done") == 0) break;
      Sleep(100);
    }
    if (lstrcmpW(state, L"done") != 0) ExitProcess(2);
    WCHAR actual[MAX_PATH];
    GetPrivateProfileStringW(L"installer", L"target", L"", actual, MAX_PATH, status);
    if (lstrcmpW(actual, target) != 0) ExitProcess(3);
  }
  HANDLE output = CreateFileW(result, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
  WriteFile(output, "PASS", 4, &written, NULL); CloseHandle(output);
  ExitProcess(0);
}
