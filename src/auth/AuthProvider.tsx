import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isAuthPKCECodeVerifierMissingError, type Session } from '@supabase/supabase-js'
import { authCallbackUrl, canonicalAuthOrigin, canonicalGoogleLoginUrl } from '../lib/auth-flow'
import { exchangeOAuthCode, googleProviderIsEnabled, isSupabaseConfigured, localPortalPreviewEnabled, supabase } from '../lib/supabase'
import type { EmployeeRow } from '../lib/database.types'
import { AuthContext } from './auth-context'

const localPreviewEmployee: EmployeeRow = {
  id: '11111111-1111-4111-8111-111111111111',
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
      setError('Your CMAC employee account is not active.')
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
    const authOrigin = canonicalAuthOrigin(window.location.origin)
    if (authOrigin !== window.location.origin) {
      window.location.assign(canonicalGoogleLoginUrl(window.location.origin))
      return
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authCallbackUrl(authOrigin),
        scopes: 'openid email profile',
      },
    })
    if (oauthError) setError('Google sign-in could not be started. Please try again.')
  }, [googleProviderStatus])

  const completeOAuthSignIn = useCallback(async (code: string, flowId?: string | null) => {
    setError(null)
    setLoading(true)

    try {
      const { data, error: exchangeError } = await exchangeOAuthCode(code, flowId)
      if (exchangeError || !data.session) {
        setSession(null)
        setEmployee(null)
        const verifierMissing = exchangeError && isAuthPKCECodeVerifierMissingError(exchangeError)
        setError(verifierMissing
          ? 'Your secure sign-in handoff expired. Reconnecting to Google…'
          : 'Google did not return a valid employee session. Please try again.')
        setLoading(false)
        return verifierMissing ? 'restart-required' : 'failed'
      }

      setSession(data.session)
      await loadEmployee(data.session)
      return 'completed'
    } catch (exchangeError) {
      setSession(null)
      setEmployee(null)
      const verifierMissing = isAuthPKCECodeVerifierMissingError(exchangeError)
      setError(verifierMissing
        ? 'Your secure sign-in handoff expired. Reconnecting to Google…'
        : 'Google sign-in could not be completed. Please try again.')
      setLoading(false)
      return verifierMissing ? 'restart-required' : 'failed'
    }
  }, [loadEmployee])

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
    completeOAuthSignIn,
    signOut,
    refreshEmployee,
  }), [session, employee, loading, googleProviderStatus, error, signInWithGoogle, completeOAuthSignIn, signOut, refreshEmployee])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
