import { ArrowRight } from 'lucide-react'

export function Logo({
  small = false,
  brand = 'CONTAINER HOMES',
  to = '/',
  onNavigate,
}: {
  small?: boolean
  brand?: string
  to?: string
  onNavigate?: (path: string) => void
}) {
  return (
    <a
      aria-label={`CMAC ${brand} home`}
      className={small ? 'logo logo-small' : 'logo'}
      href={to}
      onClick={onNavigate ? (event) => { event.preventDefault(); onNavigate(to) } : undefined}
    >
      <img src="/cmac-logo-red.png" alt="CMAC" />
      <strong data-brand={brand}>{brand}</strong>
    </a>
  )
}

export function RedButton({
  children,
  wide = false,
  href = '#consultation',
}: {
  children: React.ReactNode
  wide?: boolean
  href?: string
}) {
  return (
    <a className={wide ? 'btn btn-red btn-wide' : 'btn btn-red'} href={href}>
      {children}
      <ArrowRight size={13} strokeWidth={2.6} />
    </a>
  )
}

export function IconBox({ children, soft = false }: { children: React.ReactNode; soft?: boolean }) {
  return <span className={soft ? 'icon-box icon-box-soft' : 'icon-box'}>{children}</span>
}
