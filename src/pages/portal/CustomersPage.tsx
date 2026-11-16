import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Plus, Search } from 'lucide-react'
import { combineQueries, CRM_ROW_CAP, useCrmRows } from '../../hooks/useCrmRows'
import { useAction, useActor, useNow } from '../../hooks/useCrm'
import { useSort } from '../../hooks/useSort'
import { PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { ContactForm } from '../../components/crm/ContactForm'
import { Dialog } from '../../components/crm/Dialog'
import { SortHeader } from '../../components/crm/SortHeader'
import { ContactActions, Empty, Owner, SelectFilter, StatusBadge } from '../../components/crm/primitives'
import { transferContact } from '../../lib/crm/api'
import { csvFilename, downloadCsv } from '../../lib/crm/csv'
import { countBy, formatDate, humanize, isOpenDeal, isOpenLead, matchesSearch, relativeTime } from '../../lib/crm/pipeline'
import { employeeSelect } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'

const contactSelect = '*,owner:employees!contacts_assigned_employee_id_fkey(id,display_name,rep_code)'
const lifecycles = ['lead', 'prospect', 'customer', 'inactive']
type SortKey = 'name' | 'location' | 'lifecycle' | 'owner' | 'leads' | 'deals' | 'updated'

export default function CustomersPage() {
  const actor = useActor()
  const now = useNow()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const owner = actor.isAdmin ? params.get('owner') ?? 'all' : 'all'
  const creating = params.get('new') === '1'
  const contacts = useCrmRows('contacts', { select: contactSelect, orderBy: 'updated_at', limit: CRM_ROW_CAP })
  const leads = useCrmRows('leads', { select: 'id,contact_id,status', orderBy: 'created_at', limit: CRM_ROW_CAP })
  const deals = useCrmRows('deals', { select: 'id,contact_id,status', orderBy: 'created_at', limit: CRM_ROW_CAP })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const page = combineQueries(contacts, leads, deals)
  const bulk = useAction()
  const [search, setSearch] = useState('')
  const [lifecycle, setLifecycle] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const query = useDeferredValue(search)

  const openLeads = useMemo(() => countBy(leads.rows.filter(isOpenLead), (row) => String(row.contact_id)), [leads.rows])
  const openDeals = useMemo(() => countBy(deals.rows.filter(isOpenDeal), (row) => String(row.contact_id)), [deals.rows])
  const scoped = useMemo(() => contacts.rows.filter((contact) => {
    if (owner === 'unassigned' ? contact.assigned_employee_id != null : owner !== 'all' && contact.assigned_employee_id !== owner) return false
    return matchesSearch([contact.display_name, contact.email, contact.phone, contact.company, contact.city, contact.state, contact.project_address], query)
  }), [contacts.rows, owner, query])
  const visible = useMemo(() => scoped.filter((contact) => lifecycle === 'all' || contact.lifecycle_stage === lifecycle), [lifecycle, scoped])
  const accessors = useMemo(() => ({
    name: (row: JsonRecord) => String(row.display_name ?? ''),
    location: (row: JsonRecord) => [row.city, row.state].filter(Boolean).join(', ') || null,
    lifecycle: (row: JsonRecord) => lifecycles.indexOf(String(row.lifecycle_stage)),
    owner: (row: JsonRecord) => row.assigned_employee_id ? String((row.owner as JsonRecord | null)?.display_name ?? '') : null,
    leads: (row: JsonRecord) => -(openLeads.get(String(row.id)) ?? 0),
    deals: (row: JsonRecord) => -(openDeals.get(String(row.id)) ?? 0),
    updated: (row: JsonRecord) => String(row.updated_at ?? ''),
  }), [openDeals, openLeads])
  const table = useSort<JsonRecord, SortKey>(visible, accessors, { key: 'updated', direction: 'desc' })
  const selectedRows = table.sorted.filter((row) => selected.has(String(row.id)))

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value == null) next.delete(key); else next.set(key, value)
    setParams(next, { replace: true })
  }

  function exportCsv(rows: JsonRecord[]) {
    downloadCsv(csvFilename('customers'), rows, [
      { header: 'Name', value: (row) => row.display_name },
      { header: 'Company', value: (row) => row.company },
      { header: 'Email', value: (row) => row.email },
      { header: 'Phone', value: (row) => row.phone },
      { header: 'Project address', value: (row) => row.project_address },
      { header: 'City', value: (row) => row.city },
      { header: 'State', value: (row) => row.state },
      { header: 'Lifecycle', value: (row) => humanize(row.lifecycle_stage) },
      { header: 'Owner', value: (row) => (row.owner as JsonRecord | null)?.display_name ?? (row.assigned_employee_id ? '' : 'Unassigned') },
      { header: 'Open leads', value: (row) => openLeads.get(String(row.id)) ?? 0 },
      { header: 'Open deals', value: (row) => openDeals.get(String(row.id)) ?? 0 },
      { header: 'Created', value: (row) => formatDate(row.created_at) },
    ])
  }

  async function bulkTransfer(employeeId: string) {
    const targets = selectedRows.filter((row) => row.assigned_employee_id !== employeeId)
    const ok = await bulk.run(async () => { for (const row of targets) await transferContact(row, employeeId) }, `${targets.length} ${targets.length === 1 ? 'customer' : 'customers'} and their open work transferred.`)
    if (ok) setSelected(new Set())
  }

  if (page.loading) return <PortalLoading label="Loading customers" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />

  return (
    <section className="crm-page" aria-labelledby="customers-heading">
      <div className="crm-header">
        <div><span className="crm-eyebrow">CRM / CONTACT RECORDS</span><h2 id="customers-heading">Contacts & customers</h2><p>One record per person or company. Every lead, deal, quote, and conversation hangs off it.</p></div>
        <div className="crm-header-actions"><button className="crm-btn primary" type="button" onClick={() => setParam('new', '1')}><Plus size={15} />Add customer</button></div>
      </div>
      <div className="crm-toolbar">
        <label className="crm-search"><Search size={15} /><span className="sr-only">Search customers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" /></label>
        {actor.isAdmin ? (
          <SelectFilter label="Assigned employee" value={owner} disabled={employees.loading} onChange={(value) => setParam('owner', value === 'all' ? null : value)}>
            <option value="all">Everyone</option><option value="unassigned">Unassigned</option>
            {employees.rows.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)}{person.active ? '' : ' (inactive)'}</option>)}
          </SelectFilter>
        ) : null}
        <button className="crm-btn ghost crm-right" type="button" onClick={() => exportCsv(table.sorted)} disabled={!table.sorted.length}><Download size={14} />Export CSV</button>
      </div>
      <div className="crm-toolbar">
        <div className="crm-chips" role="group" aria-label="Lifecycle">
          <button className="crm-chip" type="button" aria-pressed={lifecycle === 'all'} onClick={() => setLifecycle('all')}>All <b>{scoped.length}</b></button>
          {lifecycles.map((stage) => <button key={stage} className="crm-chip" type="button" aria-pressed={lifecycle === stage} onClick={() => setLifecycle(stage)}>{humanize(stage)} <b>{scoped.filter((row) => row.lifecycle_stage === stage).length}</b></button>)}
        </div>
        <span className="crm-count crm-right">{visible.length} shown{contacts.rows.length === CRM_ROW_CAP ? ' · showing the 1,000 most recently updated' : ''}</span>
      </div>

      {!table.sorted.length ? <div className="crm-card"><Empty title={contacts.rows.length ? 'No records match the current filters.' : 'No customers yet'}>{contacts.rows.length ? 'Clear the search or choose another lifecycle.' : 'Customers appear after a website inquiry, a manual lead, or when you add one here.'}</Empty></div> : (
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead><tr>
              {actor.isAdmin ? <th className="check"><input type="checkbox" aria-label="Select all customers shown" checked={selectedRows.length === table.sorted.length} onChange={(event) => setSelected(event.target.checked ? new Set(table.sorted.map((row) => String(row.id))) : new Set())} /></th> : null}
              <SortHeader label="Customer" column="name" ariaSort={table.ariaSort} onSort={table.toggle} />
              <th>Reach</th>
              <SortHeader label="Location" column="location" ariaSort={table.ariaSort} onSort={table.toggle} />
              <SortHeader label="Lifecycle" column="lifecycle" ariaSort={table.ariaSort} onSort={table.toggle} />
              {actor.isAdmin ? <SortHeader label="Owner" column="owner" ariaSort={table.ariaSort} onSort={table.toggle} /> : null}
              <SortHeader label="Open leads" column="leads" ariaSort={table.ariaSort} onSort={table.toggle} numeric />
              <SortHeader label="Open deals" column="deals" ariaSort={table.ariaSort} onSort={table.toggle} numeric />
              <SortHeader label="Updated" column="updated" ariaSort={table.ariaSort} onSort={table.toggle} />
            </tr></thead>
            <tbody>
              {table.sorted.map((row) => {
                const id = String(row.id)
                const name = String(row.display_name ?? row.email)
                return (
                  <tr key={id} className={selected.has(id) ? 'selected' : undefined}>
                    {actor.isAdmin ? <td className="check"><input type="checkbox" aria-label={`Select ${name}`} checked={selected.has(id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })} /></td> : null}
                    <td><div className="crm-cell-main"><Link to={`/employee-portal/customers/${id}`}>{name}</Link><span>{[row.company && row.company !== name ? row.company : null, row.email].filter(Boolean).join(' · ')}</span></div></td>
                    <td><div style={{ display: 'flex', gap: 4 }}><ContactActions name={name} phone={row.phone} email={row.email} size={13} /></div></td>
                    <td>{[row.city, row.state].filter(Boolean).join(', ') || <span className="crm-dim">—</span>}</td>
                    <td><StatusBadge value={row.lifecycle_stage} /></td>
                    {actor.isAdmin ? <td><Owner row={row} /></td> : null}
                    <td className="num">{openLeads.get(id) ?? 0}</td>
                    <td className="num">{openDeals.get(id) ?? 0}</td>
                    <td className="crm-nowrap" title={formatDate(row.updated_at)}>{relativeTime(row.updated_at, now)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {actor.isAdmin && selectedRows.length ? (
        <div className="crm-bulkbar" role="region" aria-label="Bulk actions">
          <strong>{selectedRows.length} selected</strong>
          <select className="crm-move" style={{ marginLeft: 0, maxWidth: 200, height: 32 }} value="" disabled={bulk.busy} onChange={(event) => { if (event.target.value) void bulkTransfer(event.target.value) }} aria-label="Transfer selected customers to an employee">
            <option value="">Transfer owner…</option>
            {employees.rows.filter((person) => person.active).map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)}</option>)}
          </select>
          <button className="crm-btn small" type="button" onClick={() => exportCsv(selectedRows)}><Download size={13} />Export selected</button>
          <button className="crm-btn ghost small crm-right" type="button" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      ) : null}
      {creating ? <Dialog title="Add a customer" eyebrow="CRM / NEW CONTACT" onClose={() => setParam('new', null)}><ContactForm onCancel={() => setParam('new', null)} onSaved={(id) => navigate(`/employee-portal/customers/${id}`)} /></Dialog> : null}
    </section>
  )
}
