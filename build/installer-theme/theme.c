#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <commctrl.h>
#include <uxtheme.h>
#include <dwmapi.h>

/* Drawing only: original control procedures still handle focus, keyboard,
   radio/check state, validation and NSIS navigation/install actions. */
#define BASE RGB(5, 5, 5)
#define PANEL RGB(16, 16, 16)
#define INPUT RGB(9, 9, 9)
#define BORDER RGB(41, 41, 41)
#define LABEL RGB(229, 229, 229)
#define MUTED RGB(115, 115, 115)
#define ACCENT RGB(167, 241, 117)
#define HOVER RGB(185, 246, 149)
#define PRESSED RGB(143, 207, 99)
#define THEME_TIMER 0x504f
#define SUBCLASS_ID 0x504f

static HBRUSH panelBrush, inputBrush, baseBrush;
static HWND rootWindow;

/* No CRT startup or private UCRT imports: this library only uses Win32. */
BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID reserved) {
    (void)instance; (void)reason; (void)reserved;
    return TRUE;
}

static BOOL hasClass(HWND hwnd, const wchar_t *expected) {
    wchar_t name[64];
    GetClassNameW(hwnd, name, 64);
    return lstrcmpiW(name, expected) == 0;
}

static void fill(HDC dc, const RECT *rect, COLORREF color) {
    HBRUSH brush = CreateSolidBrush(color);
    FillRect(dc, rect, brush);
    DeleteObject(brush);
}

static void rounded(HDC dc, RECT rect, COLORREF color, COLORREF border, int radius) {
    /* GDI RoundRect has no antialiasing. Render at 4x, then box-filter each
       output pixel against the actual background for smooth, opaque edges. */
    const int scale = 4;
    int width = rect.right - rect.left, height = rect.bottom - rect.top;
    if (width <= 0 || height <= 0) return;
    BITMAPINFO info = {0};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = width * scale;
    info.bmiHeader.biHeight = -height * scale;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;
    DWORD *pixels = NULL;
    HBITMAP bitmap = CreateDIBSection(dc, &info, DIB_RGB_COLORS, (void **)&pixels, NULL, 0);
    HDC canvas = CreateCompatibleDC(dc);
    DWORD *output = HeapAlloc(GetProcessHeap(), 0, (SIZE_T)width * height * sizeof(DWORD));
    if (!bitmap || !canvas || !output) {
        if (bitmap) DeleteObject(bitmap);
        if (canvas) DeleteDC(canvas);
        if (output) HeapFree(GetProcessHeap(), 0, output);
        return;
    }
    HGDIOBJ oldBitmap = SelectObject(canvas, bitmap);
    SetStretchBltMode(canvas, COLORONCOLOR);
    StretchBlt(canvas, 0, 0, width * scale, height * scale, dc,
        rect.left, rect.top, width, height, SRCCOPY);
    HBRUSH brush = CreateSolidBrush(color);
    HPEN pen = CreatePen(PS_SOLID, scale, border);
    HGDIOBJ oldBrush = SelectObject(canvas, brush), oldPen = SelectObject(canvas, pen);
    RoundRect(canvas, 0, 0, width * scale, height * scale, radius * scale, radius * scale);
    GdiFlush();
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            unsigned red = 0, green = 0, blue = 0;
            for (int sy = 0; sy < scale; sy++) {
                for (int sx = 0; sx < scale; sx++) {
                    DWORD pixel = pixels[(y * scale + sy) * width * scale + x * scale + sx];
                    blue += pixel & 255; green += (pixel >> 8) & 255; red += (pixel >> 16) & 255;
                }
            }
            output[y * width + x] = ((red / 16) << 16) | ((green / 16) << 8) | (blue / 16);
        }
    }
    info.bmiHeader.biWidth = width;
    info.bmiHeader.biHeight = -height;
    SetDIBitsToDevice(dc, rect.left, rect.top, width, height, 0, 0, 0, height,
        output, &info, DIB_RGB_COLORS);
    SelectObject(canvas, oldBrush);
    SelectObject(canvas, oldPen);
    SelectObject(canvas, oldBitmap);
    DeleteObject(brush);
    DeleteObject(pen);
    DeleteObject(bitmap);
    DeleteDC(canvas);
    HeapFree(GetProcessHeap(), 0, output);
}

static BOOL isBranding(HWND hwnd) {
    return GetParent(hwnd) == rootWindow && GetDlgCtrlID(hwnd) == 1256;
}

static void drawBranding(HWND hwnd, HDC dc) {
    RECT rect; GetClientRect(hwnd, &rect);
    fill(dc, &rect, BASE);
    wchar_t caption[128]; GetWindowTextW(hwnd, caption, 128);
    HFONT font = (HFONT)SendMessageW(hwnd, WM_GETFONT, 0, 0);
    HGDIOBJ oldFont = font ? SelectObject(dc, font) : NULL;
    SetTextColor(dc, MUTED); SetBkMode(dc, TRANSPARENT);
    DrawTextW(dc, caption, -1, &rect, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
    if (oldFont) SelectObject(dc, oldFont);
}

static BOOL buttonHover(HWND hwnd) {
    return GetPropW(hwnd, L"Polyhedron.Hover") != NULL;
}

static void drawButton(HWND hwnd, HDC dc) {
    RECT rect;
    GetClientRect(hwnd, &rect);
    LONG_PTR type = GetWindowLongPtrW(hwnd, GWL_STYLE) & BS_TYPEMASK;
    /* A group box overlaps sibling edits/buttons. Never erase its interior. */
    if (type != BS_GROUPBOX) fill(dc, &rect, GetParent(hwnd) == rootWindow ? BASE : PANEL);
    BOOL enabled = IsWindowEnabled(hwnd);
    LRESULT state = SendMessageW(hwnd, BM_GETSTATE, 0, 0);
    BOOL pressed = (state & BST_PUSHED) != 0;
    BOOL radio = type == BS_RADIOBUTTON || type == BS_AUTORADIOBUTTON;
    BOOL check = type == BS_CHECKBOX || type == BS_AUTOCHECKBOX || type == BS_3STATE || type == BS_AUTO3STATE;
    wchar_t caption[512];
    GetWindowTextW(hwnd, caption, 512);
    HFONT font = (HFONT)SendMessageW(hwnd, WM_GETFONT, 0, 0);
    HGDIOBJ oldFont = font ? SelectObject(dc, font) : NULL;
    SetBkMode(dc, TRANSPARENT);
    UINT textFlags = DT_SINGLELINE;
    if (SendMessageW(hwnd, WM_QUERYUISTATE, 0, 0) & UISF_HIDEACCEL) textFlags |= DT_HIDEPREFIX;

    if (radio || check) {
        int height = rect.bottom - rect.top;
        int dpi = GetDeviceCaps(dc, LOGPIXELSX);
        int nominalSize = MulDiv(14, dpi, 96);
        int size = height < nominalSize + 4 ? height - 2 : nominalSize;
        if (size < 10) size = 10;
        RECT mark = {2, (height - size) / 2, 2 + size, (height + size) / 2};
        COLORREF stroke = enabled ? BORDER : MUTED;
        if (radio) {
            HPEN pen = CreatePen(PS_SOLID, 1, enabled ? ACCENT : stroke);
            HGDIOBJ oldPen = SelectObject(dc, pen), oldBrush = SelectObject(dc, inputBrush);
            Ellipse(dc, mark.left, mark.top, mark.right, mark.bottom);
            SelectObject(dc, oldPen);
            SelectObject(dc, oldBrush);
            DeleteObject(pen);
            if (SendMessageW(hwnd, BM_GETCHECK, 0, 0) == BST_CHECKED) {
                InflateRect(&mark, -4, -4);
                rounded(dc, mark, enabled ? ACCENT : MUTED, enabled ? ACCENT : MUTED, size);
            }
        } else {
            BOOL checked = SendMessageW(hwnd, BM_GETCHECK, 0, 0) != BST_UNCHECKED;
            rounded(dc, mark, checked && enabled ? ACCENT : INPUT, enabled ? ACCENT : BORDER, 4);
            if (checked) {
                HPEN pen = CreatePen(PS_SOLID, 2, enabled ? PANEL : MUTED);
                HGDIOBJ oldPen = SelectObject(dc, pen);
                MoveToEx(dc, mark.left + 3, mark.top + size / 2, NULL);
                LineTo(dc, mark.left + size / 2 - 1, mark.bottom - 4);
                LineTo(dc, mark.right - 3, mark.top + 3);
                SelectObject(dc, oldPen);
                DeleteObject(pen);
            }
        }
        rect.left += size + 9;
        SetTextColor(dc, enabled ? LABEL : MUTED);
        DrawTextW(dc, caption, -1, &rect, DT_LEFT | DT_VCENTER | textFlags);
    } else if (type == BS_GROUPBOX) {
        SetTextColor(dc, LABEL);
        DrawTextW(dc, caption, -1, &rect, DT_LEFT | DT_TOP | textFlags);
    } else {
        COLORREF background = !enabled ? BORDER : pressed ? PRESSED : buttonHover(hwnd) ? HOVER : ACCENT;
        RECT inset = rect;
        InflateRect(&inset, -1, -1);
        rounded(dc, inset, background, enabled ? background : BORDER, inset.bottom - inset.top);
        SetTextColor(dc, enabled ? PANEL : MUTED);
        if (pressed) OffsetRect(&rect, 0, 1);
        DrawTextW(dc, caption, -1, &rect, DT_CENTER | DT_VCENTER | textFlags);
    }
    if (GetFocus() == hwnd && (SendMessageW(hwnd, WM_QUERYUISTATE, 0, 0) & UISF_HIDEFOCUS) == 0) {
        RECT focus = rect;
        InflateRect(&focus, -4, -4);
        HPEN pen = CreatePen(PS_SOLID, 1, radio || check ? ACCENT : PANEL);
        HGDIOBJ oldPen = SelectObject(dc, pen), oldBrush = SelectObject(dc, GetStockObject(HOLLOW_BRUSH));
        RoundRect(dc, focus.left, focus.top, focus.right, focus.bottom, 6, 6);
        SelectObject(dc, oldPen); SelectObject(dc, oldBrush); DeleteObject(pen);
    }
    if (oldFont) SelectObject(dc, oldFont);
}

static void drawProgress(HWND hwnd, HDC dc) {
    RECT rect; GetClientRect(hwnd, &rect);
    fill(dc, &rect, PANEL);
    rounded(dc, rect, INPUT, BORDER, 8);
    PBRANGE range;
    SendMessageW(hwnd, PBM_GETRANGE, FALSE, (LPARAM)&range);
    int position = (int)SendMessageW(hwnd, PBM_GETPOS, 0, 0);
    RECT bar = rect; InflateRect(&bar, -1, -1);
    int width = bar.right - bar.left;
    int amount = range.iHigh > range.iLow ? MulDiv(width, position - range.iLow, range.iHigh - range.iLow) : 0;
    if (amount < 0) amount = 0;
    if (amount > width) amount = width;
    if (amount > 0) {
        bar.right = bar.left + amount;
        rounded(dc, bar, ACCENT, ACCENT, 6);
    }
}

static void drawBufferedButton(HWND hwnd, HDC destination) {
    RECT rect; GetClientRect(hwnd, &rect);
    HDC buffer = CreateCompatibleDC(destination);
    HBITMAP bitmap = CreateCompatibleBitmap(destination, rect.right, rect.bottom);
    if (!buffer || !bitmap) {
        if (buffer) DeleteDC(buffer);
        if (bitmap) DeleteObject(bitmap);
        return;
    }
    HGDIOBJ previous = SelectObject(buffer, bitmap);
    drawButton(hwnd, buffer);
    BitBlt(destination, 0, 0, rect.right, rect.bottom, buffer, 0, 0, SRCCOPY);
    SelectObject(buffer, previous); DeleteObject(bitmap); DeleteDC(buffer);
}

static void drawSeparator(HWND hwnd, HDC dc) {
    RECT rect; GetClientRect(hwnd, &rect);
    fill(dc, &rect, GetParent(hwnd) == rootWindow ? BASE : PANEL);
    rect.top = (rect.bottom - rect.top) / 2;
    rect.bottom = rect.top + 1;
    fill(dc, &rect, BORDER);
}

static BOOL isSeparator(HWND hwnd) {
    if (GetPropW(hwnd, L"Polyhedron.Separator")) return TRUE;
    if (!hasClass(hwnd, L"Static")) return FALSE;
    LONG_PTR type = GetWindowLongPtrW(hwnd, GWL_STYLE) & SS_TYPEMASK;
    return type == SS_ETCHEDHORZ || type == SS_ETCHEDVERT || type == SS_ETCHEDFRAME;
}

static LRESULT CALLBACK themedProcedure(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam, UINT_PTR id, DWORD_PTR data);

static BOOL CALLBACK applyChild(HWND hwnd, LPARAM unused) {
    (void)unused;
    /* GetWindowSubclass is ordinal-only in the legacy common-controls DLL
       loaded by NSIS. Track our own registration instead of importing it. */
    if (!GetPropW(hwnd, L"Polyhedron.Themed")) {
        if (!SetWindowSubclass(hwnd, themedProcedure, SUBCLASS_ID, 0)) return TRUE;
        SetPropW(hwnd, L"Polyhedron.Themed", (HANDLE)1);
        if (isSeparator(hwnd)) {
            SetPropW(hwnd, L"Polyhedron.Separator", (HANDLE)1);
            SetWindowLongPtrW(hwnd, GWL_STYLE, GetWindowLongPtrW(hwnd, GWL_STYLE) & ~(SS_TYPEMASK | SS_SUNKEN | WS_BORDER));
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, GetWindowLongPtrW(hwnd, GWL_EXSTYLE) & ~(WS_EX_STATICEDGE | WS_EX_CLIENTEDGE));
            SetWindowPos(hwnd, NULL, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED);
        }
        HFONT oldFont = (HFONT)SendMessageW(hwnd, WM_GETFONT, 0, 0);
        LOGFONTW font;
        if (oldFont && GetObjectW(oldFont, sizeof(font), &font)) {
            HDC dc = GetDC(hwnd);
            int minimum = MulDiv(12, GetDeviceCaps(dc, LOGPIXELSX), 96);
            ReleaseDC(hwnd, dc);
            if (font.lfHeight < 0 && -font.lfHeight < minimum) font.lfHeight = -minimum;
            lstrcpyW(font.lfFaceName, L"Segoe UI");
            font.lfQuality = CLEARTYPE_QUALITY;
            HFONT themedFont = CreateFontIndirectW(&font);
            if (themedFont) {
                SetPropW(hwnd, L"Polyhedron.ThemeFont", themedFont);
                SendMessageW(hwnd, WM_SETFONT, (WPARAM)themedFont, FALSE);
            }
        }
        BOOL progress = hasClass(hwnd, PROGRESS_CLASSW);
        BOOL button = hasClass(hwnd, L"Button");
        if (GetParent(hwnd) == rootWindow && (GetDlgCtrlID(hwnd) == 1028 ||
            GetDlgCtrlID(hwnd) == 1035 || GetDlgCtrlID(hwnd) == 1045)) {
            /* NSIS paints branding through both 1028 and 1256. Keep only
               our resized 1256; replace the native separators separately. */
            ShowWindow(hwnd, SW_HIDE);
            SetWindowPos(hwnd, NULL, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
        }
        if (isBranding(hwnd)) {
            RECT parent; GetClientRect(rootWindow, &parent);
            HDC dc = GetDC(hwnd); int dpi = GetDeviceCaps(dc, LOGPIXELSX); ReleaseDC(hwnd, dc);
            int margin = MulDiv(10, dpi, 96), height = MulDiv(28, dpi, 96);
            int buttonsWidth = MulDiv(286, dpi, 96);
            int width = parent.right - buttonsWidth - 3 * margin;
            if (width > 0) SetWindowPos(hwnd, NULL, margin, parent.bottom - margin - height,
                width, height, SWP_NOZORDER | SWP_NOACTIVATE);
        }
        if (button && GetParent(hwnd) == rootWindow) {
            int controlId = GetDlgCtrlID(hwnd);
            if (controlId == 1 || controlId == 2 || controlId == 3) {
                RECT parent; GetClientRect(rootWindow, &parent);
                HDC dc = GetDC(hwnd);
                int dpi = GetDeviceCaps(dc, LOGPIXELSX);
                ReleaseDC(hwnd, dc);
                int width = MulDiv(90, dpi, 96), height = MulDiv(28, dpi, 96);
                int margin = MulDiv(10, dpi, 96), gap = MulDiv(8, dpi, 96);
                int slot = controlId == 2 ? 0 : controlId == 1 ? 1 : 2;
                SetWindowPos(hwnd, NULL, parent.right - margin - width - slot * (width + gap),
                    parent.bottom - margin - height, width, height, SWP_NOZORDER | SWP_NOACTIVATE);
            }
        }
        if (progress || button || hasClass(hwnd, L"Edit") || hasClass(hwnd, WC_LISTVIEWW))
            SetWindowTheme(hwnd, L"", L"");
        if (progress) {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, GetWindowLongPtrW(hwnd, GWL_EXSTYLE) & ~WS_EX_CLIENTEDGE);
            SetWindowLongPtrW(hwnd, GWL_STYLE, GetWindowLongPtrW(hwnd, GWL_STYLE) & ~WS_BORDER);
            SetWindowPos(hwnd, NULL, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED);
            SendMessageW(hwnd, PBM_SETBARCOLOR, 0, ACCENT);
            SendMessageW(hwnd, PBM_SETBKCOLOR, 0, INPUT);
        }
        if (hasClass(hwnd, WC_LISTVIEWW)) {
            SendMessageW(hwnd, LVM_SETBKCOLOR, 0, INPUT);
            SendMessageW(hwnd, LVM_SETTEXTBKCOLOR, 0, INPUT);
            SendMessageW(hwnd, LVM_SETTEXTCOLOR, 0, LABEL);
        }
        InvalidateRect(hwnd, NULL, TRUE);
    }
    return TRUE;
}

static void layoutDivider(int controlId, int y, BOOL visible) {
    RECT root; GetClientRect(rootWindow, &root);
    HDC dc = GetDC(rootWindow); int dpi = GetDeviceCaps(dc, LOGPIXELSX); ReleaseDC(rootWindow, dc);
    int margin = MulDiv(10, dpi, 96);
    HWND line = GetDlgItem(rootWindow, controlId);
    if (!line) {
        line = CreateWindowW(L"Static", L"", WS_CHILD | SS_ETCHEDHORZ,
            margin, y, root.right - 2 * margin, 2, rootWindow, (HMENU)(INT_PTR)controlId, NULL, NULL);
        if (!line) return;
        applyChild(line, 0);
    }
    RECT current; GetWindowRect(line, &current);
    MapWindowPoints(NULL, rootWindow, (POINT *)&current, 2);
    if (current.left != margin || current.top != y || current.right != root.right - margin)
        SetWindowPos(line, NULL, margin, y, root.right - 2 * margin, 2, SWP_NOZORDER | SWP_NOACTIVATE);
    if (IsWindowVisible(line) != visible) ShowWindow(line, visible ? SW_SHOWNA : SW_HIDE);
}

static void syncDividers(void) {
    RECT root; GetClientRect(rootWindow, &root);
    HDC dc = GetDC(rootWindow); int dpi = GetDeviceCaps(dc, LOGPIXELSX); ReleaseDC(rootWindow, dc);
    layoutDivider(5001, root.bottom - MulDiv(48, dpi, 96), TRUE);
    HWND header = GetDlgItem(rootWindow, 1034);
    RECT headerRect = {0};
    if (header) {
        GetWindowRect(header, &headerRect);
        MapWindowPoints(NULL, rootWindow, (POINT *)&headerRect, 2);
    }
    layoutDivider(5002, headerRect.bottom, header && IsWindowVisible(header));
}

static LRESULT CALLBACK themedProcedure(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam, UINT_PTR id, DWORD_PTR data) {
    (void)data;
    BOOL button = hasClass(hwnd, L"Button");
    BOOL dialog = hasClass(hwnd, L"#32770");
    BOOL progress = hasClass(hwnd, PROGRESS_CLASSW);
    switch (message) {
    case WM_ERASEBKGND:
        if (dialog || button) {
            if (button) return 1; /* Commit a complete buffered frame, never erase first. */
            RECT rect; GetClientRect(hwnd, &rect);
            FillRect((HDC)wParam, &rect, hwnd == rootWindow ? baseBrush : panelBrush);
            return 1;
        }
        break;
    case WM_CTLCOLORSTATIC:
    case WM_CTLCOLORBTN:
    case WM_CTLCOLORDLG:
    case WM_CTLCOLOREDIT:
    case WM_CTLCOLORLISTBOX: {
        HDC dc = (HDC)wParam;
        HWND control = (HWND)lParam;
        BOOL input = message == WM_CTLCOLOREDIT || message == WM_CTLCOLORLISTBOX || hasClass(control, L"Edit");
        SetTextColor(dc, IsWindowEnabled(control) ? LABEL : MUTED);
        BOOL outer = hwnd == rootWindow;
        SetBkColor(dc, input ? INPUT : outer ? BASE : PANEL);
        return (LRESULT)(input ? inputBrush : outer ? baseBrush : panelBrush);
    }
    case WM_PAINT:
        if (button || progress || isSeparator(hwnd) || isBranding(hwnd)) {
            PAINTSTRUCT paint;
            HDC dc = BeginPaint(hwnd, &paint);
            if (button && (GetWindowLongPtrW(hwnd, GWL_STYLE) & BS_TYPEMASK) == BS_GROUPBOX) drawButton(hwnd, dc);
            else if (button) drawBufferedButton(hwnd, dc);
            else if (progress) drawProgress(hwnd, dc);
            else if (isBranding(hwnd)) drawBranding(hwnd, dc);
            else {
                drawSeparator(hwnd, dc);
            }
            EndPaint(hwnd, &paint);
            return 0;
        }
        break;
    case WM_PRINTCLIENT:
        if (button) { drawButton(hwnd, (HDC)wParam); return 0; }
        if (progress) { drawProgress(hwnd, (HDC)wParam); return 0; }
        if (isBranding(hwnd)) { drawBranding(hwnd, (HDC)wParam); return 0; }
        if (isSeparator(hwnd)) {
            drawSeparator(hwnd, (HDC)wParam);
            return 0;
        }
        break;
    case WM_NCPAINT:
        if (hasClass(hwnd, L"Edit")) {
            LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
            RECT rect; GetWindowRect(hwnd, &rect);
            OffsetRect(&rect, -rect.left, -rect.top);
            HDC dc = GetWindowDC(hwnd);
            HBRUSH border = CreateSolidBrush(BORDER);
            FrameRect(dc, &rect, border);
            InflateRect(&rect, -1, -1); FrameRect(dc, &rect, border);
            DeleteObject(border); ReleaseDC(hwnd, dc);
            return result;
        }
        break;
    case BM_SETCHECK:
    case BM_SETSTATE:
    case BM_CLICK:
    case BM_SETSTYLE:
    case WM_SETTEXT:
    case WM_UPDATEUISTATE:
        if (button) {
            LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
            InvalidateRect(hwnd, NULL, FALSE);
            return result;
        }
        break;
    case WM_MOUSEMOVE:
        if (button) {
            if (!GetPropW(hwnd, L"Polyhedron.Hover")) {
                SetPropW(hwnd, L"Polyhedron.Hover", (HANDLE)1);
                TRACKMOUSEEVENT tracking = {sizeof(TRACKMOUSEEVENT), TME_LEAVE, hwnd, 0};
                TrackMouseEvent(&tracking);
                InvalidateRect(hwnd, NULL, FALSE);
            }
        }
        break;
    case WM_MOUSELEAVE:
        if (button) {
            RemovePropW(hwnd, L"Polyhedron.Hover");
            InvalidateRect(hwnd, NULL, FALSE);
        }
        break;
    case WM_LBUTTONDOWN:
    case WM_LBUTTONUP:
    case WM_KEYDOWN:
    case WM_KEYUP:
    case WM_SETFOCUS:
    case WM_KILLFOCUS:
    case WM_ENABLE:
        if (button) {
            LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
            InvalidateRect(hwnd, NULL, FALSE);
            return result;
        }
        break;
    case PBM_SETPOS:
    case PBM_DELTAPOS:
    case PBM_STEPIT:
    case PBM_SETRANGE:
    case PBM_SETRANGE32:
        if (progress) {
            LRESULT result = DefSubclassProc(hwnd, message, wParam, lParam);
            RedrawWindow(hwnd, NULL, NULL, RDW_INVALIDATE | RDW_UPDATENOW);
            return result;
        }
        break;
    case WM_TIMER:
        if (hwnd == rootWindow && wParam == THEME_TIMER) {
            EnumChildWindows(hwnd, applyChild, 0);
            syncDividers();
            return 0;
        }
        break;
    case WM_NCDESTROY:
        RemovePropW(hwnd, L"Polyhedron.Themed");
        RemovePropW(hwnd, L"Polyhedron.Separator");
        RemovePropW(hwnd, L"Polyhedron.Hover");
        if (hwnd == rootWindow) { KillTimer(hwnd, THEME_TIMER); rootWindow = NULL; }
        {
            HFONT font = (HFONT)RemovePropW(hwnd, L"Polyhedron.ThemeFont");
            if (font) DeleteObject(font);
        }
        RemoveWindowSubclass(hwnd, themedProcedure, id);
        break;
    }
    return DefSubclassProc(hwnd, message, wParam, lParam);
}

__declspec(dllexport) int WINAPI ApplyTheme(HWND hwnd) {
    if (!IsWindow(hwnd)) return -1;
    if (!panelBrush) {
        panelBrush = CreateSolidBrush(PANEL);
        inputBrush = CreateSolidBrush(INPUT);
        baseBrush = CreateSolidBrush(BASE);
    }
    rootWindow = hwnd;
    if (!SetWindowSubclass(hwnd, themedProcedure, SUBCLASS_ID, 0)) return -2;
    BOOL dark = TRUE;
    if (FAILED(DwmSetWindowAttribute(hwnd, 20, &dark, sizeof(dark))))
        DwmSetWindowAttribute(hwnd, 19, &dark, sizeof(dark));
    EnumChildWindows(hwnd, applyChild, 0);
    syncDividers();
    SetTimer(hwnd, THEME_TIMER, 50, NULL);
    InvalidateRect(hwnd, NULL, TRUE);
    return 1;
}
