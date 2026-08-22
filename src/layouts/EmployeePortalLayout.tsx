import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpenCheck, BriefcaseBusiness, ChevronRight, ClipboardCheck, FileSignature,
  Files, LayoutDashboard, LogOut, Mail, Menu, PackageCheck, Plus, ReceiptText,
  ShieldCheck, UserCog, UsersRound, X, type LucideIcon,
} from 'lucide-react'
import { Logo } from '../components/ui'
import { useAuth } from '../auth/useAuth'

interface NavItem { to: string; label: string; Icon: LucideIcon; admin?: boolean }

const navItems: NavItem[] = [
  { to: '/employee-portal', label: 'Overview', Icon: LayoutDashboard },
  { to: '/employee-portal/sales/new', label: 'New sale', Icon: Plus },
  { to: '/employee-portal/leads', label: 'Leads', Icon: BriefcaseBusiness },
  { to: '/employee-portal/customers', label: 'Customers', Icon: UsersRound },
  { to: '/employee-portal/tasks', label: 'Follow-ups', Icon: ClipboardCheck },
  { to: '/employee-portal/inventory', label: 'Inventory', Icon: PackageCheck },
  { to: '/employee-portal/marketing', label: 'Marketing', Icon: Mail },
  { to: '/employee-portal/deals', label: 'Deals', Icon: BookOpenCheck },
  { to: '/employee-portal/quotes', label: 'Quotes', Icon: ReceiptText },
  { to: '/employee-portal/contracts', label: 'Contracts', Icon: FileSignature },
  { to: '/employee-portal/documents', label: 'Documents', Icon: Files },
  { to: '/employee-portal/admin/employees', label: 'Employees', Icon: UserCog, admin: true },
  { to: '/employee-portal/admin/marketing', label: 'Library admin', Icon: ShieldCheck, admin: true },
]

const routeMeta = [
  ['/sales/new', 'SALES / NEW TRANSACTION', 'Prepare a sale'],
  ['/admin/employees', 'ADMIN / ACCESS CONTROL', 'Employees'],
  ['/admin/marketing', 'ADMIN / APPROVED MATERIALS', 'Marketing library'],
  ['/leads', 'CRM / OPPORTUNITIES', 'Leads'],
  ['/customers', 'CRM / CONTACT RECORDS', 'Customers'],
  ['/tasks', 'CRM / FOLLOW-UP QUEUE', 'Follow-ups'],
  ['/inventory', 'OPERATIONS / BOLT-DATA', 'Inventory'],
  ['/marketing', 'OUTREACH / GMAIL', 'Marketing'],
  ['/deals', 'SALES / TRANSACTIONS', 'Deals'],
  ['/quotes', 'SALES / COMMERCIALS', 'Quotes'],
  ['/contracts', 'SALES / DOCUSIGN', 'Contracts'],
  ['/documents', 'SALES / CONTROLLED TEMPLATES', 'Documents'],
] as const

export default function EmployeePortalLayout() {
  const { employee, previewMode, signOut } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const meta = useMemo(() => routeMeta.find(([path]) => location.pathname.includes(path))
    ?? ['/', 'SALES / COMMAND CENTER', 'Overview'], [location.pathname])
  const initials = employee?.display_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'CM'
  const visibleNav = navItems.filter((item) => !item.admin || employee?.role === 'admin')

  return (
    <div className="employee-portal production-portal">
      <a className="skip-link" href="#portal-main">Skip to workspace</a>
      <aside className={mobileOpen ? 'portal-sidebar mobile-open' : 'portal-sidebar'}>
        <button className="portal-mobile-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        <div className="portal-sidebar-logo"><Logo small brand="SALES PORTAL" /></div>
        <div className="portal-user">
          <div className="portal-avatar">{initials}</div>
          <div><strong>{employee?.display_name}</strong><span>{employee?.role === 'admin' ? 'Administrator' : 'Sales representative'} · {employee?.rep_code}</span></div>
        </div>
        <nav aria-label="Employee portal">
          {visibleNav.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/employee-portal'} onClick={() => setMobileOpen(false)}>
              {({ isActive }) => <><Icon size={17} /><span>{label}</span>{isActive ? <ChevronRight size={14} /> : null}</>}
            </NavLink>
          ))}
        </nav>
        <div className="portal-sidebar-bottom">
          <div className="portal-env"><span /><div>{previewMode ? 'Local preview' : 'Production CRM'}<strong>{previewMode ? 'No writes or external actions' : 'Authenticated / RLS enforced'}</strong></div></div>
          <button type="button" onClick={() => void signOut()}><LogOut size={17} /> Sign out</button>
        </div>
      </aside>
      {mobileOpen ? <button className="portal-mobile-scrim" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /> : null}
      <div className="portal-workspace">
        <header className="portal-topbar">
          <div className="portal-title-row">
            <button className="portal-mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div><span className="portal-breadcrumb">{meta[1]}</span><h1>{meta[2]}</h1></div>
          </div>
          <div className="portal-top-actions"><span className="draft-status"><span /> {previewMode ? 'Local preview' : 'Secure session'}</span></div>
        </header>
        <main id="portal-main" className="portal-main production-main"><Outlet /></main>
      </div>
    </div>
  )
}
