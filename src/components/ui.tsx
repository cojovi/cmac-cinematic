import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Logo({
  small = false,
  brand = 'ROOFING',
  to = '/',
}: {
  small?: boolean
  brand?: string
  to?: string
}) {
  return (
    <Link aria-label={`CMAC ${brand} home`} className={small ? 'logo logo-small' : 'logo'} to={to}>
      <img src="/cmac-logo-red.png" alt="CMAC" />
      <strong data-brand={brand}>{brand}</strong>
    </Link>
  )
}

export function RedButton({
  children,
  wide = false,
  href = '#inspection',
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
