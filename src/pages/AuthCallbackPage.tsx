import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { providerErrorFromSearch } from '../lib/auth-flow'

export default function AuthCallbackPage() {
  const { search } = useLocation()
  const { session, employee, loading, error: authError, completeOAuthSignIn } = useAuth()
  const started = useRef(false)
  const providerError = providerErrorFromSearch(search)
  const code = new URLSearchParams(search).get('code')

  useEffect(() => {
    if (providerError || !code) return

    if (started.current) return
    started.current = true

    void completeOAuthSignIn(code).then((completed) => {
      if (completed) window.history.replaceState(window.history.state, '', '/auth/callback')
    })
  }, [code, completeOAuthSignIn, providerError])

  const missingResponseError = !code && !providerError && !loading && !session
    ? 'Google did not return a valid sign-in response. Please try again.'
    : null
  const error = providerError ?? missingResponseError ?? (!loading ? authError : null)

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
