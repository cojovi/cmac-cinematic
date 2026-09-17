import { useCallback, useEffect, useRef, useState } from 'react'
import type { JsonRecord, PublicTableName } from '../lib/database.types'
import { portalFixtures } from '../lib/portal-fixtures'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

interface QueryOptions {
  select?: string
  orderBy?: string
  ascending?: boolean
  limit?: number
  filter?: { column: string; value: string | null }
  enabled?: boolean
}

export function usePortalRows(table: PublicTableName, options: QueryOptions = {}) {
  const { previewMode } = useAuth()
  const [rows, setRows] = useState<JsonRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const select = options.select
  const orderBy = options.orderBy
  const ascending = options.ascending
  const limit = options.limit
  const filterColumn = options.filter?.column
  const filterValue = options.filter?.value
  const enabled = options.enabled ?? true
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    if (!enabled) { setRows([]); setLoading(false); setError(null); return }
    setLoading(true)
    setError(null)
    if (previewMode) {
      const preview = portalFixtures[table] ?? []
      const filtered = [...(filterColumn && filterValue !== undefined
        ? preview.filter((row) => filterValue === null ? row[filterColumn] == null : String(row[filterColumn]) === filterValue)
        : preview)]
      if (orderBy) filtered.sort((a, b) => String(a[orderBy] ?? '').localeCompare(String(b[orderBy] ?? '')) * (ascending ? 1 : -1))
      setRows(limit ? filtered.slice(0, limit) : filtered)
      setLoading(false)
      return
    }
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }

    let query = supabase.from(table).select(select ?? '*')
    if (filterColumn && filterValue !== undefined) query = filterValue === null ? query.is(filterColumn, null) : query.eq(filterColumn, filterValue)
    if (orderBy) query = query.order(orderBy, { ascending: ascending ?? false })
    if (limit) query = query.limit(limit)
    try {
      const { data, error: queryError } = await query
      if (currentRequest !== requestId.current) return
      if (queryError) { setError(queryError.message); setRows([]) }
      else setRows((data ?? []) as unknown as JsonRecord[])
    } catch {
      if (currentRequest === requestId.current) { setError('Unable to reach the CRM. Please try again.'); setRows([]) }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [ascending, enabled, filterColumn, filterValue, limit, orderBy, previewMode, select, table])

  useEffect(() => {
    const requests = requestId
    let mounted = true
    void Promise.resolve().then(() => { if (mounted) void load() })
    return () => { mounted = false; requests.current++ }
  }, [load])
  return { rows, loading, error, reload: load, previewMode }
}
