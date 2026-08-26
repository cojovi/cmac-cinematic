import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { canonicalGoogleLoginUrl, claimPkceRecovery, clearPkceRecovery, friendlyProviderError } from '../lib/auth-flow'

export default function AuthCallbackPage() {
  const { search } = useLocation()
  const { session, employee, loading, error: authError, completeOAuthSignIn } = useAuth()
  const started = useRef(false)
  const params = new URLSearchParams(search)
  const providerError = friendlyProviderError(search)
  const code = params.get('code')
  const flowId = params.get('sb_flow_id')

  useEffect(() => {
    if (providerError || !code) return

    if (started.current) return
    started.current = true

    // OAuth codes are single-use. Remove them from the visible URL before the
    // exchange so a refresh cannot replay a consumed code.
    window.history.replaceState(window.history.state, '', '/auth/callback')

    void completeOAuthSignIn(code, flowId).then((result) => {
      if (result === 'completed') {
        clearPkceRecovery(window.sessionStorage)
        return
      }
      if (result === 'restart-required' && claimPkceRecovery(window.sessionStorage)) {
        // Let the login route wait for the provider readiness check, then
        // restart once. This avoids a race between callback recovery and the
        // asynchronous Supabase settings request.
        window.location.replace(canonicalGoogleLoginUrl(window.location.origin))
      }
    })
  }, [code, completeOAuthSignIn, flowId, providerError])

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
      {error ? <a className="portal-secondary-button" href="/login">Start a fresh sign-in</a> : null}
    </main>
  )
}
