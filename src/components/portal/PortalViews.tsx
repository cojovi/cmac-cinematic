import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Files,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  Plus,
  Search,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { mockCustomers, type PortalCustomer, type PortalDocument, type PortalSection, type PortalUnit } from './portal-data'

type NavigationItem = {
  id: PortalSection
  label: string
  Icon: LucideIcon
}

const navigationItems: NavigationItem[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'sale', label: 'New sale', Icon: Plus },
  { id: 'inventory', label: 'Inventory', Icon: PackageCheck },
  { id: 'documents', label: 'Documents', Icon: Files },
  { id: 'customers', label: 'Customers', Icon: UsersRound },
]

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function PortalNavigation({
  active,
  onChange,
  mobile = false,
}: {
  active: PortalSection
  onChange: (section: PortalSection) => void
  mobile?: boolean
}) {
  return (
    <nav className={mobile ? 'portal-mobile-nav' : undefined} aria-label={mobile ? 'Mobile employee portal' : 'Employee portal'}>
      {navigationItems.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={active === id ? 'active' : undefined}
          type="button"
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
          {active === id && !mobile ? <ChevronRight size={15} aria-hidden="true" /> : null}
        </button>
      ))}
    </nav>
  )
}

export function OverviewView({ onChange }: { onChange: (section: PortalSection) => void }) {
  const metrics = [
    { label: 'Active opportunities', value: '7', note: '+2 this week', Icon: TrendingUp },
    { label: 'Open pipeline', value: '$350K', note: 'Base unit value', Icon: CircleDollarSign },
    { label: 'Ready inventory', value: '1', note: 'CH-104 available', Icon: PackageCheck },
    { label: 'Pending packages', value: '3', note: 'Awaiting customer', Icon: FileCheck2 },
  ]
  const pipeline = [
    { label: 'New leads', count: 12, width: 100 },
    { label: 'Site review', count: 5, width: 72 },
    { label: 'Proposal', count: 4, width: 58 },
    { label: 'Signature', count: 2, width: 38 },
    { label: 'Closed', count: 6, width: 66 },
  ]
  const activities = [
    { title: 'Avery Brooks opened the site checklist', meta: '14 minutes ago', Icon: Activity },
    { title: 'CH-104 marked available for sale', meta: 'Today, 8:15 AM', Icon: PackageCheck },
    { title: 'Taylor Morgan package moved to proposal', meta: 'Yesterday, 4:32 PM', Icon: FileCheck2 },
  ]

  return (
    <section className="portal-library-view" aria-labelledby="overview-heading">
      <div className="workspace-view-heading">
        <div><span>LIVE DEMO / SALES SNAPSHOT</span><h2 id="overview-heading">Good morning, Jordan.</h2><p>Your mock pipeline, follow-ups, and unit availability are summarized below.</p></div>
        <button className="portal-primary-button" type="button" onClick={() => onChange('sale')}><Plus size={16} /> Start new sale</button>
      </div>

      <div className="portal-metric-grid">
        {metrics.map(({ label, value, note, Icon }) => (
          <article key={label} className="portal-metric-card">
            <div><span>{label}</span><Icon size={18} aria-hidden="true" /></div><strong>{value}</strong><small>{note}</small>
          </article>
        ))}
      </div>

      <div className="overview-layout">
        <article className="workspace-card pipeline-card">
          <div className="workspace-card-heading"><div><span>PIPELINE / CURRENT</span><h3>Opportunity stages</h3></div><BarChart3 size={21} aria-hidden="true" /></div>
          <div className="pipeline-bars">
            {pipeline.map((item) => (
              <div key={item.label}><span>{item.label}</span><div><i style={{ width: `${item.width}%` }} /></div><strong>{item.count}</strong></div>
            ))}
          </div>
        </article>

        <article className="workspace-card task-card">
          <div className="workspace-card-heading"><div><span>NEXT / ACTIONS</span><h3>Priority follow-ups</h3></div><CalendarDays size={21} aria-hidden="true" /></div>
          <button type="button" onClick={() => onChange('customers')}><span><b>Follow up with Taylor Morgan</b><small>Proposal ready for review</small></span><ArrowRight size={15} /></button>
          <button type="button" onClick={() => onChange('inventory')}><span><b>Review site notes for CH-112</b><small>Build slot awaiting buyer</small></span><ArrowRight size={15} /></button>
          <button type="button" onClick={() => onChange('documents')}><span><b>Check warranty template</b><small>Mock review due this week</small></span><ArrowRight size={15} /></button>
        </article>

        <article className="workspace-card activity-card">
          <div className="workspace-card-heading"><div><span>ACTIVITY / RECENT</span><h3>Latest movement</h3></div><Clock3 size={21} aria-hidden="true" /></div>
          {activities.map(({ title, meta, Icon }) => <div key={title}><Icon size={16} aria-hidden="true" /><span><b>{title}</b><small>{meta}</small></span></div>)}
        </article>
      </div>
    </section>
  )
}

export function InventoryView({ units, onStartSale }: { units: PortalUnit[]; onStartSale: (unitId: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'available' | 'production'>('all')
  const [selectedId, setSelectedId] = useState(units[0].id)
  const selected = units.find((unit) => unit.id === selectedId) ?? units[0]
  const visibleUnits = filter === 'all' ? units : units.filter((unit) => (
    filter === 'available' ? unit.status === 'Available now' : unit.status !== 'Available now'
  ))

  return (
    <section className="portal-library-view" aria-labelledby="inventory-heading">
      <div className="workspace-view-heading">
        <div><span>INVENTORY / DEMO FLEET</span><h2 id="inventory-heading">Units & build slots</h2><p>Inspect mock availability, compare readiness, and begin a sale with a unit already selected.</p></div>
        <span className="workspace-live-chip"><span /> 3 units tracked</span>
      </div>
      <div className="workspace-filter-bar" role="group" aria-label="Filter inventory">
        {([['all', 'All units'], ['available', 'Available'], ['production', 'In production']] as const).map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? 'active' : undefined} onClick={() => setFilter(id)} aria-pressed={filter === id}>{label}</button>
        ))}
      </div>
      <div className="inventory-workspace">
        <div className="inventory-list">
          {visibleUnits.map((unit) => (
            <button key={unit.id} type="button" className={selectedId === unit.id ? 'inventory-row selected' : 'inventory-row'} onClick={() => setSelectedId(unit.id)} aria-pressed={selectedId === unit.id}>
              <img src={unit.image} alt="" /><span><small>{unit.id}</small><b>{unit.name}</b><em>{unit.subtitle}</em></span><span className="inventory-row-status">{unit.status}</span><strong>{money.format(unit.price)}</strong><ChevronRight size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
        <aside className="inventory-detail" aria-label={`${selected.name} details`}>
          <div className="inventory-detail-image"><img src={selected.image} alt={selected.imageAlt} /><span>{selected.status}</span></div>
          <div className="inventory-detail-copy"><span>{selected.id} / UNIT RECORD</span><h3>{selected.name}</h3><p>{selected.subtitle}</p><dl><div><dt>Base price</dt><dd>{money.format(selected.price)}</dd></div><div><dt>Readiness</dt><dd>{selected.leadTime}</dd></div><div><dt>Location</dt><dd>CMAC Texas facility</dd></div></dl><button className="portal-primary-button" type="button" onClick={() => onStartSale(selected.id)}>Start sale with {selected.id} <ArrowRight size={15} /></button></div>
        </aside>
      </div>
    </section>
  )
}

export function DocumentsView({ documents, onPreview }: { documents: PortalDocument[]; onPreview: (document: PortalDocument) => void }) {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<'All' | PortalDocument['group']>('All')
  const filtered = documents.filter((document) => (
    (group === 'All' || document.group === group) && document.title.toLowerCase().includes(search.toLowerCase())
  ))

  return (
    <section className="portal-library-view" aria-labelledby="documents-heading">
      <div className="workspace-view-heading">
        <div><span>DOCUMENTS / CONTROLLED TEMPLATES</span><h2 id="documents-heading">Sales document library</h2><p>Preview the mock templates available for customer packages. Production versions will require legal approval.</p></div>
        <span className="workspace-live-chip"><CheckCircle2 size={13} /> {documents.length} templates</span>
      </div>
      <div className="document-toolbar">
        <label className="workspace-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search documents</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search templates" /></label>
        <div className="workspace-filter-bar" role="group" aria-label="Filter documents">
          {(['All', 'Required', 'Recommended', 'Closing'] as const).map((item) => <button key={item} type="button" className={group === item ? 'active' : undefined} onClick={() => setGroup(item)} aria-pressed={group === item}>{item}</button>)}
        </div>
      </div>
      <div className="template-table" role="list">
        {filtered.map((document, index) => (
          <article key={document.id} className="template-row" role="listitem">
            <span className="template-file-icon"><FileCheck2 size={20} aria-hidden="true" /></span>
            <div><span>CMAC-TPL-{String(index + 1).padStart(2, '0')}</span><h3>{document.title}</h3><p>{document.detail}</p></div>
            <span className={`document-group group-${document.group.toLowerCase()}`}>{document.group}</span>
            <span className="template-version">v1.{index + 2}<small>Updated Aug {index + 1}</small></span>
            <button className="portal-secondary-button" type="button" onClick={() => onPreview(document)}>Preview <ArrowRight size={14} /></button>
          </article>
        ))}
      </div>
      {filtered.length === 0 ? <div className="workspace-empty"><Files size={28} /><strong>No matching templates</strong><span>Try a different search or category.</span></div> : null}
    </section>
  )
}

export function CustomersView({ onPrepareSale }: { onPrepareSale: (customer?: PortalCustomer) => void }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(mockCustomers[0].id)
  const filtered = useMemo(() => mockCustomers.filter((customer) => (
    `${customer.name} ${customer.location} ${customer.status}`.toLowerCase().includes(search.toLowerCase())
  )), [search])
  const selected = mockCustomers.find((customer) => customer.id === selectedId) ?? mockCustomers[0]

  return (
    <section className="portal-library-view" aria-labelledby="customers-heading">
      <div className="workspace-view-heading">
        <div><span>CUSTOMERS / MOCK CRM</span><h2 id="customers-heading">Customer records</h2><p>Review demo contacts and carry a selected customer directly into a new sales package.</p></div>
        <button className="portal-primary-button" type="button" onClick={() => onPrepareSale()}><Plus size={16} /> Add new customer</button>
      </div>
      <div className="customer-toolbar"><label className="workspace-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search customers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, city, or status" /></label><span>{filtered.length} records</span></div>
      <div className="customer-workspace">
        <div className="customer-list" role="list">
          {filtered.map((customer) => (
            <button key={customer.id} type="button" className={selectedId === customer.id ? 'customer-row selected' : 'customer-row'} onClick={() => setSelectedId(customer.id)} aria-pressed={selectedId === customer.id}>
              <span className="customer-initials">{customer.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><small>{customer.id}</small><b>{customer.name}</b><em><MapPin size={12} /> {customer.location}</em></span><span className="customer-status">{customer.status}</span><strong>{money.format(customer.value)}</strong><ChevronRight size={17} />
            </button>
          ))}
        </div>
        <aside className="customer-detail" aria-label={`${selected.name} customer record`}>
          <div className="customer-detail-heading"><span className="customer-initials large">{selected.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><span>{selected.id}</span><h3>{selected.name}</h3><p>{selected.status}</p></div></div>
          <dl><div><dt>Email</dt><dd>{selected.email}</dd></div><div><dt>Phone</dt><dd>{selected.phone}</dd></div><div><dt>Project location</dt><dd>{selected.location}</dd></div><div><dt>Opportunity value</dt><dd>{money.format(selected.value)}</dd></div><div><dt>Last contact</dt><dd>{selected.lastContact}</dd></div></dl>
          <button className="portal-primary-button" type="button" onClick={() => onPrepareSale(selected)}>Prepare sale <ArrowRight size={15} /></button>
        </aside>
      </div>
    </section>
  )
}
