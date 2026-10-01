import { useState, useEffect, useCallback } from 'react'
import type { ConfigKey } from '@/types'

const CONFIG_CHANGED_EVENT = 'polyhedron:config-changed'

export function useConfig() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.config.getAll().then((all) => {
      setConfig(all)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const handleConfigChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: string }>).detail
      if (!detail.key || detail.value === undefined) return
      setConfig((prev) => ({ ...prev, [detail.key!]: detail.value! }))
    }
    window.addEventListener(CONFIG_CHANGED_EVENT, handleConfigChanged)
    return () => window.removeEventListener(CONFIG_CHANGED_EVENT, handleConfigChanged)
  }, [])

  const set = useCallback(async (key: ConfigKey, value: string) => {
    await window.api.config.set({ key, value })
    setConfig((prev) => ({ ...prev, [key]: value }))
    window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT, { detail: { key, value } }))
  }, [])

  return { config, loading, set }
}
