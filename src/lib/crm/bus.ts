/**
 * Tiny invalidation bus. After a mutation, the caller names the tables it
 * touched and every mounted query for those tables refetches in the background.
 */
type Listener = (tables: Set<string>) => void

const listeners = new Set<Listener>()

export function subscribeCrm(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function invalidateCrm(...tables: string[]) {
  const changed = new Set(tables)
  for (const listener of [...listeners]) listener(changed)
}
