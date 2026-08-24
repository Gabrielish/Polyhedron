import { useCallback, useEffect, useState } from 'react'
import type { PromptSlot } from '@/types'

export function usePromptSlots() {
  const [slots, setSlots] = useState<PromptSlot[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await window.api.promptSlot.list()
    setSlots(list)
    return list
  }, [])

  useEffect(() => {
    window.api.promptSlot
      .list()
      .then(setSlots)
      .finally(() => setLoading(false))
  }, [])

  const create = useCallback(
    async (name: string, prompt: string) => {
      const slot = await window.api.promptSlot.create({ name, prompt })
      await refresh()
      return slot
    },
    [refresh]
  )

  const update = useCallback(
    async (id: number, patch: { name?: string; prompt?: string }) => {
      const slot = await window.api.promptSlot.update({ id, ...patch })
      await refresh()
      return slot
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: number) => {
      await window.api.promptSlot.delete({ id })
      await refresh()
    },
    [refresh]
  )

  return { slots, loading, refresh, create, update, remove }
}
