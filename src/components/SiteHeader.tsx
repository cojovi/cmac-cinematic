import { ChevronDown, Menu, Phone } from 'lucide-react'
import { Logo } from './ui'

type SiteHeaderProps = {
  variant: 'roofing' | 'minihomes'
  menuOpen: boolean
  onMenuToggle: () => void
}

const roofingLinks = [
  { label: 'Services', href: '#services', dropdown: true },
  { label: 'Our Process', href: '#process' },
  { label: 'About Us', href: '#footer' },
  { label: 'Locations', href: '#states' },
  { label: 'Resources', href: '#footer', dropdown: true },
  { label: 'Careers', href: '#footer' },
]

const minihomesLinks = [
  { label: 'Models', href: '#models', dropdown: true },
  { label: 'Our Process', href: '#process' },
  { label: 'About Us', href: '#footer' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Resources', href: '#footer', dropdown: true },
  { label: 'Contact', href: '#consultation' },
]

export function SiteHeader({ variant, menuOpen, onMenuToggle }: SiteHeaderProps) {
  const links = variant === 'roofing' ? roofingLinks : minihomesLinks
  const phone = variant === 'roofing' ? '8332623222' : '8312623222'
  const phoneDisplay = variant === 'roofing' ? '(833) 262-3222' : '(831) 262-3222'
  const ctaHref = variant === 'roofing' ? '#inspection' : '#consultation'
  const ctaLabel = variant === 'roofing' ? 'Request Inspection' : 'Request Consultation'

  return (
    <header className="top-nav">
      <Logo brand={variant === 'roofing' ? 'ROOFING' : 'CONTAINERS'} to={variant === 'roofing' ? '/' : '/mini-homes'} />
      <nav className={menuOpen ? 'nav-links nav-links-open' : 'nav-links'} aria-label="Primary">
        {links.map(({ label, href, dropdown }) => (
          <a key={label} href={href}>
            {label}
            {dropdown ? <ChevronDown size={10} /> : null}
          </a>
        ))}
        <a
          className="nav-route-link"
          href="https://cmac-cinematic-git-minihomes-cojovis-projects.vercel.app/"
        >
          Mini-Homes
        </a>
      </nav>
      <div className="nav-actions">
        <a className="phone-pill" href={`tel:${phone}`}>
          <Phone size={12} /> {phoneDisplay}
        </a>
        <a className="nav-request" href={ctaHref}>
          {ctaLabel}
        </a>
      </div>
      <button className="menu-button" aria-label="Toggle navigation" onClick={onMenuToggle}>
        <Menu size={20} />
      </button>
    </header>
  )
}
