import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { session, employee, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!supabase || !code) return
    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) setError(exchangeError.message)
      else navigate('/employee-portal', { replace: true })
    })
  }, [navigate])

  if (!loading && session && employee) return <Navigate to="/employee-portal" replace />

  return (
    <main className="route-guard-state" aria-live="polite">
      <div className="route-guard-icon">{error ? <ShieldCheck /> : <LoaderCircle className="spin" />}</div>
      <span>GOOGLE WORKSPACE / CALLBACK</span>
      <h1>{error ? 'Sign-in could not be completed' : 'Securing your session'}</h1>
      <p>{error ?? 'Linking your Google identity to the CMAC employee allowlist.'}</p>
      {error ? <a className="portal-secondary-button" href="/login">Try sign-in again</a> : null}
    </main>
  )
}
