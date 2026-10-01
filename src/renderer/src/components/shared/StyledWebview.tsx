import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const WEBVIEW_SCROLLBAR_CSS = `
  html {
    scrollbar-width: thin;
    scrollbar-color: #2a2f37 transparent;
  }
  *::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  *::-webkit-scrollbar-track {
    background: transparent;
  }
  *::-webkit-scrollbar-thumb {
    background: #2a2f37;
    border: 3px solid transparent;
    border-radius: 6px;
    background-clip: content-box;
    transition: background-color 250ms ease;
  }
  *::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
    border: 3px solid transparent;
    background-clip: content-box;
  }
  html.polyhedron-scrollbars-auto-hide *::-webkit-scrollbar-thumb {
    background-color: transparent;
    transition: background-color 450ms ease;
  }
  html.polyhedron-scrollbars-auto-hide .polyhedron-scrollbars-visible::-webkit-scrollbar-thumb {
    background-color: #2a2f37;
  }
  *::-webkit-scrollbar-button,
  *::-webkit-scrollbar-button:single-button,
  *::-webkit-scrollbar-button:vertical:start:decrement,
  *::-webkit-scrollbar-button:vertical:end:increment,
  *::-webkit-scrollbar-button:horizontal:start:decrement,
  *::-webkit-scrollbar-button:horizontal:end:increment {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    background: none !important;
    -webkit-appearance: none !important;
    appearance: none !important;
  }
`

const WEBVIEW_SCROLLBAR_SCRIPT = `
  (() => {
    document.documentElement.classList.add('polyhedron-scrollbars-auto-hide')
    const timers = new WeakMap()
    const showScrollbar = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      target.classList.add('polyhedron-scrollbars-visible')
      const previousTimer = timers.get(target)
      if (previousTimer) clearTimeout(previousTimer)
      timers.set(target, setTimeout(() => target.classList.remove('polyhedron-scrollbars-visible'), 1500))
    }
    document.addEventListener('scroll', showScrollbar, true)
  })()
`

type StyledWebviewProps = React.HTMLAttributes<HTMLElement> & {
  src?: string
  allowpopups?: boolean
}

export const StyledWebview = forwardRef<HTMLElement, StyledWebviewProps>(function StyledWebview(
  { onLoad, ...props },
  forwardedRef
): React.JSX.Element {
  const webviewRef = useRef<HTMLElement | null>(null)
  useImperativeHandle(forwardedRef, () => webviewRef.current as HTMLElement, [])

  useEffect(() => {
    const webview = webviewRef.current as HTMLElement & {
      insertCSS?: (css: string) => Promise<string>
      executeJavaScript?: (code: string) => Promise<unknown>
    }
    if (!webview) return

    const injectScrollbar = () => {
      const injectedCSS = webview.insertCSS?.(WEBVIEW_SCROLLBAR_CSS)
      void injectedCSS?.then(() => webview.executeJavaScript?.(WEBVIEW_SCROLLBAR_SCRIPT)).catch(() => undefined)
    }
    webview.addEventListener('did-finish-load', injectScrollbar)
    return () => webview.removeEventListener('did-finish-load', injectScrollbar)
  }, [])

  return <webview ref={webviewRef} {...props} onLoad={onLoad} />
})
