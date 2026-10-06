import { useEffect, useState } from 'react'

export function useTranslationSuggestionAvailability(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let disposed = false
    let request = 0
    const refresh = () => {
      const current = ++request
      void window.api.translationSuggestions.list()
        .then(sources => {
          if (!disposed && current === request) {
            setAvailable(sources.some(source => source.enabled && source.available))
          }
        })
        .catch(() => {
          if (!disposed && current === request) setAvailable(false)
        })
    }
    const unsubscribe = window.api.translationSuggestions.onChanged(refresh)
    refresh()
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  return available
}
