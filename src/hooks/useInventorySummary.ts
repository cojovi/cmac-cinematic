import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import type { InventorySummary } from '../lib/database.types'

type InventoryErrorCode = 'not_configured' | 'unauthorized' | 'unavailable'

export function isInventoryStale(lastSyncedAt: string, now = new Date().getTime()) {
  const timestamp = new Date(lastSyncedAt).getTime()
  return !Number.isFinite(timestamp) || now - timestamp > 3_600_000
}

export function useInventorySummary() {
  const { session, previewMode } = useAuth()
  const accessToken = session?.access_token
  const [data, setData] = useState<InventorySummary | null>(null)
  const [loading, setLoading] = useState(!previewMode)
  const [error, setError] = useState<{ code: InventoryErrorCode; message: string } | null>(previewMode ? { code: 'not_configured', message: 'Live inventory is unavailable in local preview mode.' } : null)
  const [stale, setStale] = useState(false)

  const load = useCallback(async () => {
    if (previewMode) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/inventory', { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} })
      const payload = await response.json() as InventorySummary & { error?: { code?: string; message?: string } }
      if (!response.ok) {
        const code = payload.error?.code === 'not_configured' ? 'not_configured' : response.status === 401 || response.status === 403 ? 'unauthorized' : 'unavailable'
        setError({ code, message: payload.error?.message ?? 'Live inventory is unavailable.' })
        setData(null)
      } else {
        setData(payload)
        setStale(isInventoryStale(payload.last_synced_at))
      }
    } catch {
      setData(null)
      setError({ code: 'unavailable', message: 'Live inventory could not be reached.' })
    } finally {
      setLoading(false)
    }
  }, [accessToken, previewMode])

  useEffect(() => { void Promise.resolve().then(load) }, [load])
  return { data, loading, error, stale, retry: load }
}
