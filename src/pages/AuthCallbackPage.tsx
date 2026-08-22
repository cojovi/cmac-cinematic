import { Navigate } from 'react-router-dom'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/useAuth'

export default function AuthCallbackPage() {
  const { session, employee, loading, error: authError } = useAuth()
  const params = new URLSearchParams(window.location.search)
  const providerError = params.get('error_description') ?? params.get('error')
  const error = providerError ?? (!loading ? authError : null)

  if (!loading && session && employee) return <Navigate to="/employee-portal" replace />

  return (
    <main className="route-guard-state" aria-live="polite">
      <div className="route-guard-icon">{error ? <ShieldCheck /> : <LoaderCircle className="spin" />}</div>
      <span>GOOGLE WORKSPACE / CALLBACK</span>
      <h1>{error ? 'Sign-in could not be completed' : 'Securing your session'}</h1>
      <p>{error ?? 'Linking your verified CMAC Workspace identity to the sales portal.'}</p>
      {error ? <a className="portal-secondary-button" href="/login">Try sign-in again</a> : null}
    </main>
  )
}
