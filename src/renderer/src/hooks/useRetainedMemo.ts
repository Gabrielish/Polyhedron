import { useMemo, type DependencyList } from 'react'

// Retain only the latest inputs/result for each named index, not mounted pages.
// Object identity invalidates session-derived data immediately after an edit.
const retained = new Map<string, { dependencies: DependencyList; value: unknown }>()

export function useRetainedMemo<T>(key: string, factory: () => T, dependencies: DependencyList): T {
  return useMemo(() => {
    const cached = retained.get(key)
    if (
      cached &&
      cached.dependencies.length === dependencies.length &&
      dependencies.every((value, index) => Object.is(value, cached.dependencies[index]))
    ) {
      return cached.value as T
    }
    const value = factory()
    retained.set(key, { dependencies: [...dependencies], value })
    return value
  }, dependencies)
}
