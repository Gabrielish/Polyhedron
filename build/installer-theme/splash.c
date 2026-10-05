// Tiny native splash, on its own UI thread while NSIS extracts Electron.
#include <windows.h>

static WCHAR iconPath[MAX_PATH];
static HANDLE splashThread;
static HWND splashWindow;
static HICON splashIcon;

static LRESULT CALLBACK SplashProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_PAINT) {
    PAINTSTRUCT paint;
    HDC dc = BeginPaint(window, &paint);
    RECT bounds; GetClientRect(window, &bounds);
    HBRUSH background = CreateSolidBrush(RGB(16, 16, 16));
    FillRect(dc, &bounds, background); DeleteObject(background);
    HBRUSH border = CreateSolidBrush(RGB(41, 41, 41));
    FrameRect(dc, &bounds, border); DeleteObject(border);
    if (splashIcon) DrawIconEx(dc, 148, 28, splashIcon, 64, 64, 0, NULL, DI_NORMAL);
    HFONT font = CreateFontW(-16, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
      DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
      DEFAULT_PITCH, L"Segoe UI");
    HGDIOBJ previous = SelectObject(dc, font);
    SetBkMode(dc, TRANSPARENT); SetTextColor(dc, RGB(229, 229, 229));
    RECT text = {16, 110, 344, 150};
    DrawTextW(dc, L"Starting setup\x2026", -1, &text, DT_CENTER | DT_SINGLELINE | DT_VCENTER);
    SelectObject(dc, previous); DeleteObject(font);
    EndPaint(window, &paint); return 0;
  }
  if (message == WM_CLOSE) { DestroyWindow(window); return 0; }
  if (message == WM_DESTROY) { splashWindow = NULL; PostQuitMessage(0); return 0; }
  return DefWindowProcW(window, message, wparam, lparam);
}

static DWORD WINAPI SplashMain(LPVOID unused) {
  (void)unused;
  HINSTANCE instance = GetModuleHandleW(NULL);
  WNDCLASSW wc = {0};
  wc.lpfnWndProc = SplashProc; wc.hInstance = instance;
  wc.hCursor = LoadCursorW(NULL, MAKEINTRESOURCEW(32512)); wc.lpszClassName = L"PolyhedronSetupSplash";
  RegisterClassW(&wc);
  splashIcon = (HICON)LoadImageW(NULL, iconPath, IMAGE_ICON, 64, 64, LR_LOADFROMFILE);
  RECT work; SystemParametersInfoW(SPI_GETWORKAREA, 0, &work, 0);
  splashWindow = CreateWindowExW(WS_EX_TOOLWINDOW | WS_EX_TOPMOST,
    wc.lpszClassName, L"Polyhedron Setup", WS_POPUP,
    work.left + (work.right - work.left - 360) / 2,
    work.top + (work.bottom - work.top - 176) / 2,
    360, 176, NULL, NULL, instance, NULL);
  if (splashWindow) {
    ShowWindow(splashWindow, SW_SHOWNOACTIVATE); UpdateWindow(splashWindow);
    MSG message;
    while (GetMessageW(&message, NULL, 0, 0) > 0) {
      TranslateMessage(&message); DispatchMessageW(&message);
    }
  }
  if (splashIcon) DestroyIcon(splashIcon);
  UnregisterClassW(wc.lpszClassName, instance);
  return 0;
}

__declspec(dllexport) void __stdcall ShowSplash(LPCWSTR path) {
  lstrcpynW(iconPath, path, MAX_PATH);
  splashThread = CreateThread(NULL, 0, SplashMain, NULL, 0, NULL);
}

__declspec(dllexport) void __stdcall HideSplash(void) {
  if (splashWindow) PostMessageW(splashWindow, WM_CLOSE, 0, 0);
  if (splashThread) { WaitForSingleObject(splashThread, 2000); CloseHandle(splashThread); splashThread = NULL; }
}

BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID reserved) {
  (void)instance; (void)reason; (void)reserved; return TRUE;
}
