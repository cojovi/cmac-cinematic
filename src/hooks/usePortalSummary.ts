import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabase'
import { portalFixtures } from '../lib/portal-fixtures'
import { fixtureDashboard, fixtureTeam, type DashboardSummary, type TeamOverview } from '../lib/team-management'

interface Summaries { admin_team_overview: TeamOverview; portal_dashboard_summary: DashboardSummary }

export function usePortalSummary<T extends keyof Summaries>(name: T) {
  const { previewMode } = useAuth()
  const [data, setData] = useState<Summaries[T] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const reload = useCallback(async () => {
    const current = ++generation.current
    setLoading(true); setError(null)
    try {
      if (previewMode) {
        setData((name === 'admin_team_overview' ? fixtureTeam(portalFixtures) : fixtureDashboard(portalFixtures)) as Summaries[T])
      } else {
        if (!supabase) throw new Error('The CRM is not configured.')
        const result = await supabase.rpc(name)
        if (current !== generation.current) return
        if (result.error) throw new Error(result.error.message)
        setData(result.data as unknown as Summaries[T])
      }
    } catch (err) {
      if (current === generation.current) { setData(null); setError(err instanceof Error ? err.message : 'Unable to load the summary.') }
    } finally { if (current === generation.current) setLoading(false) }
  }, [name, previewMode])
  useEffect(() => {
    const requests = generation
    let mounted = true
    void Promise.resolve().then(() => { if (mounted) void reload() })
    return () => { mounted = false; requests.current++ }
  }, [reload])
  return { data, loading, error, reload }
}
