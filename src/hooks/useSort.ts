import { useMemo, useState } from 'react'

export interface SortState<Key extends string> { key: Key; direction: 'asc' | 'desc' }

type Accessors<Row, Key extends string> = Record<Key, (row: Row) => string | number | null>

function compare(a: string | number | null, b: string | number | null) {
  if (a == null && b == null) return 0
  if (a == null) return 1 // blanks sort last in either direction
  if (b == null) return -1
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function useSort<Row, Key extends string>(rows: Row[], accessors: Accessors<Row, Key>, initial: SortState<Key>) {
  const [sort, setSort] = useState(initial)
  const sorted = useMemo(() => {
    const accessor = accessors[sort.key]
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const left = accessor(a)
      const right = accessor(b)
      if (left == null || right == null) return compare(left, right)
      return compare(left, right) * factor
    })
  }, [accessors, rows, sort])
  const toggle = (key: Key) => setSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
  const ariaSort = (key: Key): 'ascending' | 'descending' | 'none' => sort.key !== key ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending'
  return { sorted, sort, toggle, ariaSort }
}
