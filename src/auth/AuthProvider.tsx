import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { googleProviderIsEnabled, isSupabaseConfigured, localPortalPreviewEnabled, supabase } from '../lib/supabase'
import type { EmployeeRow } from '../lib/database.types'
import { AuthContext } from './auth-context'

const localPreviewEmployee: EmployeeRow = {
  id: '00000000-0000-0000-0000-000000000001',
  auth_user_id: null,
  email: 'preview@cmaccontainers.com',
  first_name: 'Local',
  last_name: 'Preview',
  display_name: 'Local Preview',
  role: 'admin',
  rep_code: 'CMAC-PREVIEW',
  phone: null,
  active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [employee, setEmployee] = useState<EmployeeRow | null>(localPortalPreviewEnabled ? localPreviewEmployee : null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [googleProviderStatus, setGoogleProviderStatus] = useState<'checking' | 'enabled' | 'disabled' | 'unavailable'>(isSupabaseConfigured ? 'checking' : 'disabled')
  const [error, setError] = useState<string | null>(null)

  const loadEmployee = useCallback(async (nextSession: Session | null) => {
    if (!supabase || !nextSession) {
      setEmployee(localPortalPreviewEnabled ? localPreviewEmployee : null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', nextSession.user.id)
      .eq('active', true)
      .maybeSingle()

    if (employeeError) {
      setError(employeeError.message)
      setEmployee(null)
    } else if (!data || !['admin', 'sales_rep'].includes(String(data.role))) {
      setError('Your Google account is not on the active CMAC employee allowlist.')
      setEmployee(null)
    } else {
      setError(null)
      setEmployee(data as EmployeeRow)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) return

    let current = true
    supabase.auth.getSession().then(({ data }) => {
      if (!current) return
      setSession(data.session)
      void loadEmployee(data.session)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadEmployee(nextSession)
    })

    return () => {
      current = false
      subscription.subscription.unsubscribe()
    }
  }, [loadEmployee])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let current = true
    googleProviderIsEnabled()
      .then((enabled) => {
        if (current) setGoogleProviderStatus(enabled ? 'enabled' : 'disabled')
      })
      .catch(() => {
        if (current) setGoogleProviderStatus('unavailable')
      })
    return () => { current = false }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase || googleProviderStatus !== 'enabled') {
      setError('Employee sign-in is not configured in this environment.')
      return
    }
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'openid email profile',
      },
    })
    if (oauthError) setError(oauthError.message)
  }, [googleProviderStatus])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setEmployee(localPortalPreviewEnabled ? localPreviewEmployee : null)
  }, [])

  const refreshEmployee = useCallback(async () => {
    await loadEmployee(session)
  }, [loadEmployee, session])

  const value = useMemo(() => ({
    session,
    employee,
    loading,
    configured: isSupabaseConfigured,
    googleProviderStatus,
    previewMode: localPortalPreviewEnabled,
    error,
    signInWithGoogle,
    signOut,
    refreshEmployee,
  }), [session, employee, loading, googleProviderStatus, error, signInWithGoogle, signOut, refreshEmployee])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
