import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3, BookOpenCheck, BriefcaseBusiness, ClipboardCheck, LayoutDashboard, PackageCheck, Plus, ReceiptText, Search, UserRound, UsersRound, type LucideIcon,
} from 'lucide-react'
import { useCrmRows } from '../../hooks/useCrmRows'
import { contactOf } from '../../lib/crm/links'
import { dealStage, leadStage, matchesSearch } from '../../lib/crm/pipeline'

interface Item { id: string; group: string; label: string; detail?: string; to: string; Icon: LucideIcon; keywords: string }

const shortcuts: Item[] = [
  { id: 'new-lead', group: 'Actions', label: 'Add a lead', to: '/employee-portal/leads/new', Icon: Plus, keywords: 'create new lead intake' },
  { id: 'new-sale', group: 'Actions', label: 'Start a new sale', to: '/employee-portal/sales/new', Icon: Plus, keywords: 'create deal sale wizard' },
  { id: 'new-contact', group: 'Actions', label: 'Add a customer', to: '/employee-portal/customers?new=1', Icon: Plus, keywords: 'create contact customer' },
  { id: 'new-task', group: 'Actions', label: 'Schedule a follow-up', to: '/employee-portal/tasks?new=1', Icon: Plus, keywords: 'create task follow-up reminder' },
  { id: 'go-overview', group: 'Go to', label: 'Overview', to: '/employee-portal', Icon: LayoutDashboard, keywords: 'dashboard home' },
  { id: 'go-leads', group: 'Go to', label: 'Lead pipeline', to: '/employee-portal/leads', Icon: BriefcaseBusiness, keywords: 'leads board kanban' },
  { id: 'go-customers', group: 'Go to', label: 'Customers', to: '/employee-portal/customers', Icon: UsersRound, keywords: 'contacts customers' },
  { id: 'go-tasks', group: 'Go to', label: 'Follow-ups', to: '/employee-portal/tasks', Icon: ClipboardCheck, keywords: 'tasks follow-ups todo' },
  { id: 'go-deals', group: 'Go to', label: 'Deals', to: '/employee-portal/deals', Icon: BookOpenCheck, keywords: 'deals pipeline' },
  { id: 'go-quotes', group: 'Go to', label: 'Quotes', to: '/employee-portal/quotes', Icon: ReceiptText, keywords: 'quotes pricing' },
  { id: 'go-inventory', group: 'Go to', label: 'Inventory', to: '/employee-portal/inventory', Icon: PackageCheck, keywords: 'inventory units models' },
  { id: 'go-reports', group: 'Go to', label: 'Reports', to: '/employee-portal/reports', Icon: BarChart3, keywords: 'reports analytics funnel' },
]

/** Global search: jump to any customer, lead, or deal, or start a common action, without leaving the keyboard. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const contacts = useCrmRows('contacts', { select: 'id,display_name,email,phone,company,lifecycle_stage', orderBy: 'updated_at', limit: 1000 })
  const leads = useCrmRows('leads', { select: 'id,status,project_type,project_location,contacts(display_name,email,phone)', orderBy: 'created_at', limit: 1000 })
  const deals = useCrmRows('deals', { select: 'id,deal_number,project_name,stage,contacts(display_name,email)', orderBy: 'updated_at', limit: 1000 })

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    return () => { if (element?.open) element.close() }
  }, [])

  const items = useMemo(() => {
    const records: Item[] = [
      ...contacts.rows.map((row): Item => ({ id: `c-${String(row.id)}`, group: 'Customers', label: String(row.display_name ?? row.email), detail: [row.company, row.email].filter(Boolean).join(' · '), to: `/employee-portal/customers/${String(row.id)}`, Icon: UserRound, keywords: [row.email, row.phone, row.company].join(' ') })),
      ...leads.rows.map((row): Item => ({ id: `l-${String(row.id)}`, group: 'Leads', label: String(contactOf(row).display_name ?? 'Lead'), detail: [leadStage(row.status).label, row.project_type, row.project_location].filter(Boolean).join(' · '), to: `/employee-portal/leads/${String(row.id)}`, Icon: BriefcaseBusiness, keywords: [contactOf(row).email, contactOf(row).phone, row.project_type, row.project_location].join(' ') })),
      ...deals.rows.map((row): Item => ({ id: `d-${String(row.id)}`, group: 'Deals', label: String(row.deal_number ?? 'Deal'), detail: [contactOf(row).display_name, row.project_name, dealStage(row.stage).label].filter(Boolean).join(' · '), to: `/employee-portal/deals/${String(row.id)}`, Icon: BookOpenCheck, keywords: [contactOf(row).display_name, contactOf(row).email, row.project_name].join(' ') })),
    ]
    const matches = (item: Item) => matchesSearch([item.label, item.detail, item.keywords], query)
    // With no query, show actions and destinations only; records appear as soon as the user types.
    return query.trim() ? [...shortcuts.filter(matches), ...records.filter(matches).slice(0, 30)] : shortcuts
  }, [contacts.rows, deals.rows, leads.rows, query])

  const current = Math.min(active, Math.max(0, items.length - 1))

  function go(item: Item | undefined) {
    if (!item) return
    onClose()
    navigate(item.to)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length)
      setActive(next)
      list.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') { event.preventDefault(); go(items[current]) }
  }

  let lastGroup = ''
  return (
    <dialog ref={dialog} className="crm-palette" aria-label="Search the CRM" onCancel={(event) => { event.preventDefault(); onClose() }} onMouseDown={(event) => { if (event.target === dialog.current) onClose() }}>
      <div className="crm-palette-input">
        <Search size={17} />
        <input value={query} onChange={(event) => { setQuery(event.target.value); setActive(0) }} onKeyDown={onKeyDown} placeholder="Search customers, leads, deals, or actions" aria-label="Search the CRM" role="combobox" aria-expanded="true" aria-controls="crm-palette-list" aria-activedescendant={items[current] ? `crm-palette-${items[current].id}` : undefined} autoFocus />
        <kbd>Esc</kbd>
      </div>
      <ul className="crm-palette-list" id="crm-palette-list" role="listbox" ref={list}>
        {!items.length ? <li className="crm-palette-empty">{contacts.loading || leads.loading || deals.loading ? 'Searching…' : 'No matches. Try a name, email, phone number, or deal number.'}</li> : items.map((item, index) => {
          const heading = item.group !== lastGroup ? <li className="crm-palette-group" role="presentation">{item.group}</li> : null
          lastGroup = item.group
          return (
            <FragmentRow key={item.id} heading={heading}>
              <li id={`crm-palette-${item.id}`} className="crm-palette-item" role="option" aria-selected={index === current} data-index={index} onMouseEnter={() => setActive(index)} onClick={() => go(item)}>
                <item.Icon size={15} /><span>{item.label}</span>{item.detail ? <small>{item.detail}</small> : null}
              </li>
            </FragmentRow>
          )
        })}
      </ul>
    </dialog>
  )
}

function FragmentRow({ heading, children }: { heading: React.ReactNode; children: React.ReactNode }) {
  return <>{heading}{children}</>
}
