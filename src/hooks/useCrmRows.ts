import { useCallback, useEffect, useRef, useState } from 'react'
import type { JsonRecord, PublicTableName } from '../lib/database.types'
import { portalFixtures } from '../lib/portal-fixtures'
import { supabase } from '../lib/supabase'
import { subscribeCrm } from '../lib/crm/bus'
import { useAuth } from '../auth/useAuth'

/** The Data API returns at most this many rows per request (Supabase `max_rows`). Screens say so when a list reaches it. */
export const CRM_ROW_CAP = 1000

export interface CrmQueryOptions {
  select?: string
  orderBy?: string
  ascending?: boolean
  limit?: number
  filter?: { column: string; value: string | null }
  enabled?: boolean
}

/**
 * Reads one RLS-scoped table. Unlike usePortalRows it keeps the previous rows
 * on screen while refetching, and refetches automatically when a mutation
 * invalidates its table — so boards and lists never flash back to a spinner.
 */
export function useCrmRows(table: PublicTableName, options: CrmQueryOptions = {}) {
  const { previewMode } = useAuth()
  const [rows, setRows] = useState<JsonRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { select, orderBy, ascending, limit } = options
  const filterColumn = options.filter?.column
  const filterValue = options.filter?.value
  const enabled = options.enabled ?? true
  const requestId = useRef(0)

  const load = useCallback(async (background = false) => {
    const current = ++requestId.current
    if (!enabled) { setRows([]); setLoading(false); setRefreshing(false); setError(null); return }
    if (background) setRefreshing(true)
    else { setLoading(true); setError(null) }

    if (previewMode) {
      const source = portalFixtures[table] ?? []
      const filtered = filterColumn && filterValue !== undefined
        ? source.filter((row) => filterValue === null ? row[filterColumn] == null : String(row[filterColumn]) === filterValue)
        : [...source]
      if (orderBy) filtered.sort((a, b) => String(a[orderBy] ?? '').localeCompare(String(b[orderBy] ?? '')) * (ascending ? 1 : -1))
      setRows(limit ? filtered.slice(0, limit) : filtered)
      setError(null); setLoading(false); setRefreshing(false)
      return
    }
    if (!supabase) { setError('The CRM is not configured in this environment.'); setLoading(false); setRefreshing(false); return }

    let query = supabase.from(table).select(select ?? '*')
    if (filterColumn && filterValue !== undefined) query = filterValue === null ? query.is(filterColumn, null) : query.eq(filterColumn, filterValue)
    if (orderBy) query = query.order(orderBy, { ascending: ascending ?? false })
    if (limit) query = query.limit(limit)
    try {
      const { data, error: queryError } = await query
      if (current !== requestId.current) return
      if (queryError) { setError(queryError.message); if (!background) setRows([]) }
      // A proxy or misconfigured endpoint can answer 200 with a non-list body; treat that as no rows, not a crash.
      else { setError(null); setRows(Array.isArray(data) ? data as unknown as JsonRecord[] : []) }
    } catch {
      if (current === requestId.current) { setError('Unable to reach the CRM. Please try again.'); if (!background) setRows([]) }
    } finally {
      if (current === requestId.current) { setLoading(false); setRefreshing(false) }
    }
  }, [ascending, enabled, filterColumn, filterValue, limit, orderBy, previewMode, select, table])

  useEffect(() => {
    const requests = requestId
    let mounted = true
    void Promise.resolve().then(() => { if (mounted) void load() })
    const unsubscribe = subscribeCrm((tables) => { if (mounted && tables.has(table)) void load(true) })
    return () => { mounted = false; requests.current++; unsubscribe() }
  }, [load, table])

  const reload = useCallback(() => load(true), [load])
  return { rows, loading, refreshing, error, reload }
}

/** Combine several queries into one loading / error state for a page. */
export function combineQueries(...queries: { loading: boolean; error: string | null; reload: () => Promise<void> }[]) {
  return {
    loading: queries.some((query) => query.loading),
    error: queries.find((query) => query.error)?.error ?? null,
    reload: () => { void Promise.all(queries.map((query) => query.reload())) },
  }
}
