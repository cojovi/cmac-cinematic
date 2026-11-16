import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, BookOpenCheck, BriefcaseBusiness, ChevronRight, ClipboardCheck, FileSignature,
  Files, LayoutDashboard, LogOut, Mail, Menu, PackageCheck, Plus, ReceiptText,
  Search, ShieldCheck, UserCog, UsersRound, X, QrCode, type LucideIcon,
} from 'lucide-react'
import { Logo } from '../components/ui'
import { useAuth } from '../auth/useAuth'
import { ToastProvider } from '../components/crm/ToastProvider'
import { CommandPalette } from '../components/crm/CommandPalette'
import { ErrorBoundary } from '../components/crm/ErrorBoundary'
import { useCrmRows } from '../hooks/useCrmRows'
import { useNow } from '../hooks/useCrm'

interface NavItem { to: string; label: string; Icon: LucideIcon; badge?: 'new_leads' | 'due_tasks' }
interface NavGroup { label: string | null; admin?: boolean; items: NavItem[] }

const navGroups: NavGroup[] = [
  { label: null, items: [{ to: '/employee-portal', label: 'Overview', Icon: LayoutDashboard }] },
  { label: 'Pipeline', items: [
    { to: '/employee-portal/leads', label: 'Leads', Icon: BriefcaseBusiness, badge: 'new_leads' },
    { to: '/employee-portal/customers', label: 'Customers', Icon: UsersRound },
    { to: '/employee-portal/tasks', label: 'Follow-ups', Icon: ClipboardCheck, badge: 'due_tasks' },
  ] },
  { label: 'Sales', items: [
    { to: '/employee-portal/deals', label: 'Deals', Icon: BookOpenCheck },
    { to: '/employee-portal/quotes', label: 'Quotes', Icon: ReceiptText },
    { to: '/employee-portal/sales/new', label: 'New sale', Icon: Plus },
    { to: '/employee-portal/contracts', label: 'Contracts', Icon: FileSignature },
    { to: '/employee-portal/documents', label: 'Documents', Icon: Files },
  ] },
  { label: 'Tools', items: [
    { to: '/employee-portal/inventory', label: 'Inventory', Icon: PackageCheck },
    { to: '/employee-portal/marketing', label: 'Marketing', Icon: Mail },
    { to: '/employee-portal/reports', label: 'Reports', Icon: BarChart3 },
  ] },
  { label: 'Admin', admin: true, items: [
    { to: '/employee-portal/admin/employees', label: 'Employees', Icon: UserCog },
    { to: '/employee-portal/admin/marketing', label: 'Library admin', Icon: ShieldCheck },
    { to: '/employee-portal/admin/qr', label: 'QR Code', Icon: QrCode },
  ] },
]

const routeMeta = [
  ['/sales/new', 'SALES / NEW TRANSACTION', 'Prepare a sale'],
  ['/admin/employees', 'ADMIN / ACCESS CONTROL', 'Employees'],
  ['/admin/marketing', 'ADMIN / APPROVED MATERIALS', 'Marketing library'],
  ['/admin/qr', 'ADMIN / QR INQUIRIES', 'QR Code'],
  ['/leads', 'CRM / OPPORTUNITIES', 'Leads'],
  ['/customers', 'CRM / CONTACT RECORDS', 'Customers'],
  ['/tasks', 'CRM / FOLLOW-UP QUEUE', 'Follow-ups'],
  ['/reports', 'CRM / PERFORMANCE', 'Reports'],
  ['/inventory', 'OPERATIONS / BOLT-DATA', 'Inventory'],
  ['/marketing', 'OUTREACH / GMAIL', 'Marketing'],
  ['/deals', 'SALES / TRANSACTIONS', 'Deals'],
  ['/quotes', 'SALES / COMMERCIALS', 'Quotes'],
  ['/contracts', 'SALES / DOCUSIGN', 'Contracts'],
  ['/documents', 'SALES / CONTROLLED TEMPLATES', 'Documents'],
] as const

function PortalShell() {
  const { employee, previewMode, signOut } = useAuth()
  const location = useLocation()
  const now = useNow()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const newLeads = useCrmRows('leads', { select: 'id,status', filter: { column: 'status', value: 'new' }, limit: 1000 })
  const openTasks = useCrmRows('tasks', { select: 'id,due_at,status', filter: { column: 'status', value: 'open' }, limit: 1000 })
  const meta = useMemo(() => routeMeta.find(([path]) => location.pathname.includes(path))
    ?? ['/', 'SALES / COMMAND CENTER', 'Overview'], [location.pathname])
  const initials = employee?.display_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'CM'
  const isAdmin = employee?.role === 'admin'
  const badges = {
    new_leads: newLeads.rows.length,
    due_tasks: openTasks.rows.filter((task) => new Date(String(task.due_at)).getTime() <= now).length,
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((open) => !open) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="employee-portal production-portal">
      <a className="skip-link" href="#portal-main">Skip to workspace</a>
      <aside className={mobileOpen ? 'portal-sidebar mobile-open' : 'portal-sidebar'}>
        <button className="portal-mobile-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        <div className="portal-sidebar-logo"><Logo small brand="SALES PORTAL" /></div>
        <div className="portal-user">
          <div className="portal-avatar">{initials}</div>
          <div><strong>{employee?.display_name}</strong><span>{isAdmin ? 'Administrator' : 'Sales representative'} · {employee?.rep_code}</span></div>
        </div>
        <nav aria-label="Employee portal">
          {navGroups.filter((group) => !group.admin || isAdmin).map((group) => (
            <div key={group.label ?? 'home'}>
              {group.label ? <span className="portal-nav-group">{group.label}</span> : null}
              {group.items.map(({ to, label, Icon, badge }) => {
                const count = badge ? badges[badge] : 0
                return (
                  <NavLink key={to} to={to} end={to === '/employee-portal'} onClick={() => setMobileOpen(false)}>
                    {({ isActive }) => <>
                      <Icon size={17} /><span>{label}</span>
                      {count > 0 ? <span className={badge === 'due_tasks' ? 'portal-nav-badge' : 'portal-nav-badge quiet'} title={badge === 'due_tasks' ? `${count} follow-ups due` : `${count} new leads`}>{count}<span className="sr-only">{badge === 'due_tasks' ? ' follow-ups due' : ' new leads'}</span></span> : isActive ? <ChevronRight size={14} /> : null}
                    </>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="portal-sidebar-bottom">
          <div className="portal-env"><span /><div>{previewMode ? 'Local preview' : 'Production CRM'}<strong>{previewMode ? 'Sample data · resets on refresh' : 'Authenticated / RLS enforced'}</strong></div></div>
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
          <div className="portal-top-actions">
            <button className="crm-topbar-search" type="button" onClick={() => setPaletteOpen(true)} aria-label="Search the CRM"><Search size={15} /><span>Search</span><kbd className="crm-kbd">⌘K</kbd></button>
            <span className="draft-status"><span /> {previewMode ? 'Local preview' : 'Secure session'}</span>
          </div>
        </header>
        <main id="portal-main" className="portal-main production-main"><ErrorBoundary key={location.pathname}><Outlet /></ErrorBoundary></main>
      </div>
      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  )
}

export default function EmployeePortalLayout() {
  return <ToastProvider><PortalShell /></ToastProvider>
}
