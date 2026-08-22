import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle, LoaderCircle, Settings2 } from 'lucide-react'
import { useAuth } from './useAuth'

function GuardMessage({ kind, title, copy }: { kind: 'loading' | 'denied'; title: string; copy: string }) {
  return (
    <main className="route-guard-state" aria-live="polite">
      <div className="route-guard-icon">
        {kind === 'loading' ? <LoaderCircle className="spin" aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
      </div>
      <span>CMAC / SALES SYSTEM</span>
      <h1>{title}</h1>
      <p>{copy}</p>
      {kind === 'denied' ? <a className="portal-secondary-button" href="/login"><Settings2 size={16} /> Return to login</a> : null}
    </main>
  )
}

export function RequireEmployee() {
  const { loading, employee, session, configured, previewMode } = useAuth()
  const location = useLocation()

  if (loading) return <GuardMessage kind="loading" title="Verifying access" copy="Checking your CMAC employee session and allowlist record." />
  if (previewMode && employee) return <Outlet />
  if (!configured) return <GuardMessage kind="denied" title="Configuration required" copy="Supabase authentication has not been configured for this environment. No employee access has been granted." />
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (!employee) return <GuardMessage kind="denied" title="Access not authorized" copy="This Google account does not have an active CMAC employee record." />
  return <Outlet />
}

export function RequireAdmin() {
  const { employee } = useAuth()
  if (employee?.role !== 'admin') {
    return <GuardMessage kind="denied" title="Admin access required" copy="This area is limited to active CMAC administrators." />
  }
  return <Outlet />
}
