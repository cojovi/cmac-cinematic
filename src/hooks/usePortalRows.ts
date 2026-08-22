import { useCallback, useEffect, useState } from 'react'
import type { JsonRecord } from '../lib/database.types'
import { portalFixtures } from '../lib/portal-fixtures'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

interface QueryOptions {
  select?: string
  orderBy?: string
  ascending?: boolean
  limit?: number
  filter?: { column: string; value: string }
}

export function usePortalRows(table: string, options: QueryOptions = {}) {
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (previewMode) {
      const preview = portalFixtures[table] ?? []
      const filtered = filterColumn && filterValue
        ? preview.filter((row) => String(row[filterColumn]) === filterValue)
        : preview
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
    if (filterColumn && filterValue) query = query.eq(filterColumn, filterValue)
    if (orderBy) query = query.order(orderBy, { ascending: ascending ?? false })
    if (limit) query = query.limit(limit)
    const { data, error: queryError } = await query
    if (queryError) setError(queryError.message)
    else setRows((data ?? []) as unknown as JsonRecord[])
    setLoading(false)
  }, [ascending, filterColumn, filterValue, limit, orderBy, previewMode, select, table])

  useEffect(() => { void Promise.resolve().then(load) }, [load])
  return { rows, loading, error, reload: load, previewMode }
}
