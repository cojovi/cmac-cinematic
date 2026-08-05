import { type FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Building2, Eye, EyeOff, HardHat, LockKeyhole, ShieldCheck } from 'lucide-react'
import { AccessHeader } from '../components/AccessHeader'

export default function LoginPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('sales@cmaccontainers.com')
  const [password, setPassword] = useState('cmac-demo')

  useEffect(() => {
    document.title = 'Login | CMAC Container Homes'
  }, [])

  function enterPortal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onNavigate('/employee-portal')
  }

  return (
    <div className="access-page">
      <a className="skip-link" href="#access-main">Skip to main content</a>
      <AccessHeader onNavigate={onNavigate} />
      <main id="access-main" className="access-main">
        <section className="access-intro" aria-labelledby="login-title">
          <div className="access-intro-copy">
            <span className="portal-eyebrow"><span className="signal-dot" /> CMAC secure workspace</span>
            <h1 id="login-title">Choose your<br /><span>way in.</span></h1>
            <p>Internal sales preparation is ready for testing. The client experience is being built for the next phase.</p>
          </div>
          <div className="access-system-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <div><strong>Prototype access</strong><span>No credentials are verified and no customer data is stored.</span></div>
          </div>
        </section>

        <section className="role-grid" aria-label="Portal options">
          <article className="role-card role-card-employee">
            <div className="role-card-heading">
              <span className="role-number">01 / INTERNAL</span>
              <HardHat size={32} aria-hidden="true" />
            </div>
            <h2>Employee Login</h2>
            <p>Prepare a unit sale, customer record, pricing summary, and complete document package.</p>
            <form className="demo-login-form" onSubmit={enterPortal}>
              <label htmlFor="employee-email">Work email</label>
              <input id="employee-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <label htmlFor="employee-password">Password</label>
              <div className="password-field">
                <input
                  id="employee-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
              <button className="portal-primary-button" type="submit">
                Enter demo portal <ArrowRight size={16} aria-hidden="true" />
              </button>
            </form>
            <span className="demo-credential-note"><LockKeyhole size={13} aria-hidden="true" /> Any credentials work during testing</span>
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
            <button className="portal-secondary-button" type="button" onClick={() => onNavigate('/client-portal')}>
              Preview what’s coming <ArrowRight size={16} aria-hidden="true" />
            </button>
          </article>
        </section>
      </main>
      <footer className="access-footer"><span>CMAC Container Homes</span><span>Sales systems / prototype 01</span></footer>
    </div>
  )
}
