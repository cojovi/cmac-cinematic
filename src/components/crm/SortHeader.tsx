import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

export function SortHeader<Key extends string>({ label, column, ariaSort, onSort, numeric = false }: {
  label: string; column: Key; ariaSort: (key: Key) => 'ascending' | 'descending' | 'none'; onSort: (key: Key) => void; numeric?: boolean
}) {
  const state = ariaSort(column)
  return (
    <th aria-sort={state} className={numeric ? 'num' : undefined}>
      <button type="button" onClick={() => onSort(column)}>
        {label}
        {state === 'ascending' ? <ArrowUp size={12} /> : state === 'descending' ? <ArrowDown size={12} /> : <ChevronsUpDown size={12} />}
      </button>
    </th>
  )
}
