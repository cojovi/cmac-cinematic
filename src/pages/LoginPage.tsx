import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, KeyRound, HardHat, LockKeyhole, ShieldCheck } from 'lucide-react'
import { AccessHeader } from '../components/AccessHeader'
import { useAuth } from '../auth/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { employee, session, configured, googleProviderStatus, previewMode, loading, error, signInWithGoogle } = useAuth()

  useEffect(() => {
    document.title = 'Login | CMAC Container Homes'
  }, [])

  if (!loading && employee && (session || previewMode)) return <Navigate to="/employee-portal" replace />

  return (
    <div className="access-page">
      <a className="skip-link" href="#access-main">Skip to main content</a>
      <AccessHeader onNavigate={(path) => navigate(path)} />
      <main id="access-main" className="access-main">
        <section className="access-intro" aria-labelledby="login-title">
          <div className="access-intro-copy">
            <span className="portal-eyebrow"><span className="signal-dot" /> CMAC secure workspace</span>
            <h1 id="login-title">Choose your<br /><span>way in.</span></h1>
            <p>Authorized CMAC employees can manage the customer journey from first inquiry through signed contract and unit attribution.</p>
          </div>
          <div className="access-system-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <div><strong>Workspace protected</strong><span>Verified CMAC Google Workspace identity and active employee status are checked at every sign-in.</span></div>
          </div>
        </section>

        <section className="role-grid" aria-label="Portal options">
          <article className="role-card role-card-employee">
            <div className="role-card-heading">
              <span className="role-number">01 / INTERNAL</span>
              <HardHat size={32} aria-hidden="true" />
            </div>
            <h2>Employee Login</h2>
            <p>Manage leads, follow-ups, approved outreach, quotes, contracts, and auditable unit sales.</p>
            <div className="demo-login-form production-login-action">
              <button className="portal-primary-button" type="button" onClick={() => void signInWithGoogle()} disabled={!configured || loading || googleProviderStatus !== 'enabled'}>
                <KeyRound size={17} aria-hidden="true" /> Continue with Google
              </button>
              {!configured ? <p className="login-config-message" role="status">Google Workspace sign-in is not configured in this environment.</p> : null}
              {configured && googleProviderStatus === 'checking' ? <p className="login-config-message" role="status">Checking Google Workspace sign-in…</p> : null}
              {configured && googleProviderStatus === 'disabled' ? <p className="login-config-message login-error" role="alert">Google Workspace sign-in is not enabled in Supabase yet.</p> : null}
              {configured && googleProviderStatus === 'unavailable' ? <p className="login-config-message login-error" role="alert">Google Workspace sign-in could not be checked. Please try again.</p> : null}
              {error ? <p className="login-config-message login-error" role="alert">{error}</p> : null}
            </div>
            <span className="demo-credential-note"><LockKeyhole size={13} aria-hidden="true" /> CMAC Workspace accounts only · passwords never handled here</span>
          </article>

          <article className="role-card role-card-client">
            <div className="role-card-heading">
              <span className="role-number">02 / CUSTOMER</span>
              <Building2 size={32} aria-hidden="true" />
            </div>
            <div>
              <span className="coming-pill">Coming soon</span>
              <h2>Client Login</h2>
              <p>A future home for signatures, invoices, payment milestones, delivery updates, and handover documents.</p>
            </div>
            <button className="portal-secondary-button" type="button" onClick={() => navigate('/client-portal')}>
              Preview what’s coming <ArrowRight size={16} aria-hidden="true" />
            </button>
          </article>
        </section>
      </main>
      <footer className="access-footer"><span>CMAC Container Homes</span><span>Sales systems / secure workspace</span></footer>
    </div>
  )
}
