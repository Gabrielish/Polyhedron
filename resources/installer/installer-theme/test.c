/* Hidden-window regression test; never installs or opens the actual wizard.
   Compile alongside theme.c, using the target Windows toolchain. */
#define UNICODE
#define _UNICODE
#include <windows.h>
#include <commctrl.h>

int WINAPI ApplyTheme(HWND hwnd);

static void trace(const char *step) {
    wchar_t path[MAX_PATH]; GetTempPathW(MAX_PATH, path);
    lstrcatW(path, L"Polyhedron-theme-test-steps.txt");
    HANDLE file = CreateFileW(path, FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE,
        NULL, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    DWORD written;
    WriteFile(file, step, lstrlenA(step), &written, NULL);
    WriteFile(file, "\r\n", 2, &written, NULL);
    CloseHandle(file);
}

static int runTest(void) {
    trace("start");
    INITCOMMONCONTROLSEX common = {sizeof(common), ICC_WIN95_CLASSES};
    InitCommonControlsEx(&common);
    HWND parent = CreateWindowW(L"#32770", L"Theme test", WS_POPUP,
        -3000, -3000, 500, 200, NULL, NULL, NULL, NULL);
    HWND button = CreateWindowW(L"Button", L"Next", WS_CHILD | BS_PUSHBUTTON,
        0, 0, 100, 30, parent, (HMENU)1, NULL, NULL);
    /* Parent stays hidden; mark the radio visible so native group traversal
       can return to it instead of looping over the newly created dividers. */
    HWND radio = CreateWindowW(L"Button", L"Only me", WS_CHILD | WS_VISIBLE | WS_GROUP | WS_TABSTOP | BS_AUTORADIOBUTTON,
        0, 40, 200, 25, parent, (HMENU)101, NULL, NULL);
    HWND progress = CreateWindowW(PROGRESS_CLASSW, L"", WS_CHILD,
        0, 80, 200, 25, parent, NULL, NULL, NULL);
    HWND group = CreateWindowW(L"Button", L"Destination Folder", WS_CHILD | BS_GROUPBOX,
        0, 0, 200, 80, parent, NULL, NULL, NULL);
    HWND separator = CreateWindowW(L"Static", L"", WS_CHILD | SS_ETCHEDHORZ,
        0, 0, 200, 2, parent, NULL, NULL, NULL);
    HWND branding = CreateWindowW(L"Static", L"Polyhedron 1.0.0", WS_CHILD,
        0, 120, 150, 8, parent, (HMENU)1256, NULL, NULL);
    SendMessageW(branding, WM_SETFONT, (WPARAM)GetStockObject(DEFAULT_GUI_FONT), FALSE);
    HWND oldBranding = CreateWindowW(L"Static", L"Polyhedron 1.0.0", WS_CHILD,
        0, 110, 150, 8, parent, (HMENU)1028, NULL, NULL);
    if (!parent || !button || !radio || !progress) return 1;
    trace("before theme");
    if (ApplyTheme(parent) != 1) return 6;
    trace("after theme");
    HDC screen = GetDC(NULL), dc = CreateCompatibleDC(screen);
    HBITMAP bitmap = CreateCompatibleBitmap(screen, 200, 100);
    HGDIOBJ previous = SelectObject(dc, bitmap);
    SendMessageW(button, WM_PRINTCLIENT, (WPARAM)dc, PRF_CLIENT);
    if (GetPixel(dc, 10, 10) != RGB(167, 241, 117)) return 2;
    int blended = 0;
    for (int y = 1; y < 6; y++) {
        for (int x = 0; x < 100; x++) {
            COLORREF pixel = GetPixel(dc, x, y);
            if (GetRValue(pixel) > 5 && GetRValue(pixel) < 167 &&
                GetGValue(pixel) > 5 && GetGValue(pixel) < 241) blended++;
        }
    }
    if (blended < 4) return 12;
    trace("after edge test");
    if ((GetWindowLongW(button, GWL_STYLE) & BS_TYPEMASK) != BS_PUSHBUTTON) return 14;
    SendMessageW(button, WM_MOUSEMOVE, 0, MAKELPARAM(10, 10));
    trace("after first mousemove");
    SendMessageW(button, WM_PRINTCLIENT, (WPARAM)dc, PRF_CLIENT);
    if (GetPixel(dc, 10, 10) != RGB(185, 246, 149)) return 15;
    ValidateRect(button, NULL);
    for (int i = 0; i < 30; i++) SendMessageW(button, WM_MOUSEMOVE, 0, MAKELPARAM(10, 10));
    if (GetUpdateRect(button, NULL, FALSE)) return 16;
    COLORREF beforeErase = GetPixel(dc, 10, 10);
    SendMessageW(button, WM_ERASEBKGND, (WPARAM)dc, 0);
    if (GetPixel(dc, 10, 10) != beforeErase) return 17;
    SendMessageW(button, WM_MOUSELEAVE, 0, 0);
    trace("after hover test");
    EnableWindow(button, FALSE);
    SendMessageW(button, WM_PRINTCLIENT, (WPARAM)dc, PRF_CLIENT);
    if (GetPixel(dc, 10, 10) != RGB(41, 41, 41)) return 3;
    EnableWindow(button, TRUE);
    SendMessageW(button, BM_SETSTYLE, BS_DEFPUSHBUTTON, TRUE);
    SendMessageW(button, WM_PRINTCLIENT, (WPARAM)dc, PRF_CLIENT);
    if (GetPixel(dc, 10, 10) != RGB(167, 241, 117)) return 7;
    if ((GetWindowLongW(button, GWL_STYLE) & BS_TYPEMASK) != BS_DEFPUSHBUTTON) return 18;
    if (!(SendMessageW(button, WM_GETDLGCODE, 0, 0) & DLGC_DEFPUSHBUTTON)) return 19;
    trace("after state test");
    SendMessageW(radio, BM_CLICK, 0, 0);
    trace("after radio click");
    if (SendMessageW(radio, BM_GETCHECK, 0, 0) != BST_CHECKED) return 4;
    SendMessageW(progress, PBM_SETPOS, 60, 0);
    trace("after progress update");
    if (SendMessageW(progress, PBM_GETPOS, 0, 0) != 60) return 5;
    SendMessageW(progress, WM_PRINTCLIENT, (WPARAM)dc, PRF_CLIENT);
    if (GetPixel(dc, 10, 10) != RGB(167, 241, 117)) return 8;
    if (GetPixel(dc, 150, 10) != RGB(9, 9, 9)) return 9;
    SetPixel(dc, 10, 60, RGB(255, 0, 255));
    SendMessageW(group, WM_PRINTCLIENT, (WPARAM)dc, PRF_CLIENT);
    if (GetPixel(dc, 10, 60) != RGB(255, 0, 255)) return 10;
    SendMessageW(separator, WM_PRINTCLIENT, (WPARAM)dc, PRF_CLIENT);
    if (GetPixel(dc, 10, 0) != RGB(5, 5, 5)) {
        char message[128]; DWORD bytes;
        int length = wsprintfA(message, "Separator pixel=%x, style=%x, themed=%d\r\n", (UINT)GetPixel(dc, 10, 0),
            (UINT)GetWindowLongW(separator, GWL_STYLE), GetPropW(separator, L"Polyhedron.Themed") != NULL);
        WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), message, length, &bytes, NULL);
        return 11;
    }
    if (GetPixel(dc, 10, 1) != RGB(41, 41, 41)) return 20;
    RECT legacy; GetClientRect(oldBranding, &legacy);
    if (legacy.right || legacy.bottom) return 21;
    if (!GetDlgItem(parent, 5001) || !GetDlgItem(parent, 5002)) return 22;
    RECT footer; GetClientRect(branding, &footer);
    HGDIOBJ oldFont = SelectObject(dc, (HFONT)SendMessageW(branding, WM_GETFONT, 0, 0));
    TEXTMETRICW metrics; GetTextMetricsW(dc, &metrics);
    SelectObject(dc, oldFont);
    if (footer.bottom < metrics.tmHeight + 4) return 13;
    SelectObject(dc, previous);
    DeleteObject(bitmap);
    DeleteDC(dc);
    ReleaseDC(NULL, screen);
    trace("before destroy");
    DestroyWindow(parent);
    trace("after destroy");
    const char passed[] = "PASS: stable hover without repeated invalidations or background erasure, native button keyboard semantics, single footer label and thin dividers.\r\n";
    DWORD written;
    WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), passed, sizeof(passed) - 1, &written, NULL);
    return 0;
}

void WINAPI TestEntry(void) { ExitProcess((UINT)runTest()); }
