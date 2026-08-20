import { LogIn, Menu, Phone, X } from 'lucide-react'
import { Logo } from './ui'
import { ThemeToggle } from './ThemeToggle'

type SiteHeaderProps = {
  menuOpen: boolean
  onMenuToggle: () => void
  onNavigate: () => void
  onRouteNavigate: (path: string) => void
}

const navLinks = [
  { label: 'Container Homes', href: '#home', current: true },
  { label: 'Models', href: '#models' },
  { label: 'Build Process', href: '#process' },
  { label: 'Service Area', href: '#service-area' },
  { label: 'Contact', href: '#consultation' },
]

export function SiteHeader({ menuOpen, onMenuToggle, onNavigate, onRouteNavigate }: SiteHeaderProps) {
  return (
    <header className="top-nav">
      <div className="scroll-signal" aria-hidden="true" />
      <Logo />
      <nav id="primary-navigation" className={menuOpen ? 'nav-links nav-links-open' : 'nav-links'} aria-label="Primary">
        {navLinks.map(({ label, href, current }) => (
          <a key={label} href={href} aria-current={current ? 'page' : undefined} onClick={onNavigate}>
            {label}
          </a>
        ))}
        <a
          className="nav-login"
          href="/login"
          onClick={(event) => {
            event.preventDefault()
            onNavigate()
            onRouteNavigate('/login')
          }}
        >
          <LogIn size={15} aria-hidden="true" /> Login
        </a>
        <a className="mobile-nav-phone" href="tel:8312623222" onClick={onNavigate}>
          <Phone size={15} aria-hidden="true" /> (831) 262-3222
        </a>
        <ThemeToggle className="mobile-theme-toggle" />
      </nav>
      <div className="nav-actions">
        <ThemeToggle />
        <a className="phone-pill" href="tel:8312623222" aria-label="Call CMAC Container Homes at 831 262 3222">
          <Phone size={14} aria-hidden="true" /> (831) 262-3222
        </a>
        <a className="nav-request" href="#consultation">
          Request a Quote
        </a>
      </div>
      <button
        className="menu-button"
        type="button"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={onMenuToggle}
      >
        {menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
      </button>
    </header>
  )
}
