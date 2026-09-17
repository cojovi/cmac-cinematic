import { useDeferredValue, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Activity, ArrowUpRight, RefreshCw, Search, ShieldCheck, UserPlus, UsersRound } from 'lucide-react'
import { usePortalRows } from '../../hooks/usePortalRows'
import { usePortalSummary } from '../../hooks/usePortalSummary'
import { useAuth } from '../../auth/useAuth'
import { PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import ActivityFeed from '../../components/portal/ActivityFeed'
import { activitySelect, formatRecordDate, type TeamEmployee } from '../../lib/team-management'
import { runAdminAction } from '../../lib/admin-api'

function EmployeeAccessForm({ person, onSaved }: { person?: TeamEmployee; onSaved: () => Promise<void> }) {
  const { employee, previewMode } = useAuth()
  const [form, setForm] = useState({ first_name: person?.first_name ?? '', last_name: person?.last_name ?? '', email: person?.email ?? '', phone: String(person?.phone ?? ''), role: person?.role ?? 'sales_rep' })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const isSelf = person?.id === employee?.id
  async function mutate(action: string) {
    if (pending) return
    setError(null); setMessage(null)
    if (previewMode) { setMessage('Local preview only — no employee access was changed.'); return }
    if (action === 'deactivate' && !window.confirm(`Deactivate ${person?.display_name}? Sign-in and CRM access will be blocked. Their assigned records stay with them until you transfer those customers.`)) return
    if (action === 'update' && person?.role !== form.role && !window.confirm(`Change ${person?.display_name} to ${form.role === 'admin' ? 'administrator with company-wide access' : 'sales representative with assigned-record access only'}?`)) return
    setPending(true)
    try {
      const result = await runAdminAction({ action, employee_id: person?.id, employee: form })
      setMessage(result.message)
      if (!person) setForm({ first_name: '', last_name: '', email: '', phone: '', role: 'sales_rep' })
      await onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Employee update failed. Please retry.') }
    finally { setPending(false) }
  }
  function submit(event: FormEvent) { event.preventDefault(); void mutate(person ? 'update' : 'create') }
  return <form className="record-action-form team-access-form" onSubmit={submit}>
    <div className="admin-form-grid">
      <label><span>First name</span><input required maxLength={100} value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label>
      <label><span>Last name</span><input required maxLength={100} value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label>
      <label className="field-wide"><span>CMAC email</span><input type="email" required readOnly={Boolean(person)} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><small>{person ? 'Google identity is fixed. Contact an administrator for identity corrections.' : 'Verified CMAC Google users can also join automatically as sales representatives.'}</small></label>
      {person ? <label><span>Phone</span><input type="tel" maxLength={50} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label> : null}
      <label><span>Role</span><select value={form.role} disabled={isSelf} onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'sales_rep' })}><option value="sales_rep">Sales representative</option><option value="admin">Administrator</option></select></label>
    </div>
    {isSelf ? <p className="team-helper"><ShieldCheck size={15} /> Your own administrator access is protected.</p> : null}
    {error ? <PortalError message={error} /> : null}{message ? <p role="status" className="record-action-message">{message}</p> : null}
    <div className="team-form-actions"><button className="portal-primary-button" type="submit" disabled={pending}>{pending ? 'Saving…' : person ? 'Save employee' : 'Add employee'}</button>
      {person ? <button className="portal-secondary-button" type="button" disabled={pending || isSelf} onClick={() => void mutate(person.active ? 'deactivate' : 'activate')}>{person.active ? 'Deactivate access' : 'Reactivate access'}</button> : null}
    </div>
  </form>
}

export default function EmployeesAdminPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('employee') ?? ''
  const summary = usePortalSummary('admin_team_overview')
  const [search, setSearch] = useState('')
  const [access, setAccess] = useState('all')
  const [activityLimit, setActivityLimit] = useState(25)
  const { previewMode } = useAuth()
  const activities = usePortalRows('activities', { select: activitySelect, filter: selectedId ? { column: 'employee_id', value: selectedId } : undefined, orderBy: 'created_at', limit: activityLimit })
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const people = summary.data?.employees ?? []
  const selected = people.find(person => person.id === selectedId)
  const visible = people.filter(person => `${person.display_name} ${person.email} ${person.rep_code}`.toLowerCase().includes(deferredSearch) && (access === 'all' || (access === 'active' ? person.active : !person.active)))
  const reload = async () => { await Promise.all([summary.reload(), activities.reload()]) }
  const selectPerson = (id: string) => { setParams(id ? { employee: id } : {}); setActivityLimit(25) }
  if (summary.loading && !summary.data) return <PortalLoading label="Loading team ownership and activity" />
  if (summary.error) return <PortalError message={summary.error} retry={() => void reload()} />
  const data = summary.data!
  const totals = people.reduce((acc, person) => ({ leads: acc.leads + person.leads, tasks: acc.tasks + person.tasks, overdue: acc.overdue + person.overdue }), { leads: 0, tasks: 0, overdue: 0 })
  return <section className="portal-library-view team-page" aria-labelledby="employees-heading">
    <div className="workspace-view-heading"><div><span>ADMIN / PEOPLE & OWNERSHIP</span><h2 id="employees-heading">Employee access</h2><p>Your team, their customers, and the work moving forward. Select a person to inspect assignments, review activity, or manage access.</p></div><button className="portal-secondary-button" disabled={summary.loading} onClick={() => void reload()}><RefreshCw size={15} /> Refresh</button></div>
    {previewMode ? <p className="team-preview" role="status">LOCAL PREVIEW · Sample team and activity. Changes are never saved.</p> : null}
    <div className="team-stats" aria-label="Company team summary">
      <div><UsersRound size={18} /><strong>{people.filter(person => person.active).length}<span>Active employees</span></strong></div>
      <div><ArrowUpRight size={18} /><strong>{totals.leads}<span>Assigned open leads</span></strong></div>
      <div><Activity size={18} /><strong>{totals.tasks}<span>Open follow-ups</span></strong></div>
      <div className={totals.overdue ? 'needs-attention' : ''}><strong>{totals.overdue}<span>Overdue follow-ups</span></strong></div>
    </div>
    {data.unassigned_contacts || data.unassigned_leads ? <div className="team-triage"><strong>Needs an owner</strong><Link to="/employee-portal/customers?owner=unassigned">{data.unassigned_contacts} unassigned customers ↗</Link><Link to="/employee-portal/leads?owner=unassigned">{data.unassigned_leads} unassigned open leads ↗</Link></div> : null}
    <div className="resource-toolbar"><label className="workspace-search"><Search size={16} /><span className="sr-only">Search employees</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, or rep code" /></label><label className="resource-status-filter"><span>Access</span><select value={access} onChange={e => setAccess(e.target.value)}><option value="all">All employees</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button className="portal-secondary-button" onClick={() => selectPerson('')}>All team activity</button></div>
    <div className="team-roster">{visible.map(person => <button type="button" className={`team-person-card ${selectedId === person.id ? 'selected' : ''}`} aria-pressed={selectedId === person.id} key={person.id} onClick={() => selectPerson(person.id)}>
      <div className="team-person-heading"><span className="customer-initials">{person.display_name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><strong>{person.display_name}</strong><small>{person.rep_code} · {person.role === 'admin' ? 'Administrator' : 'Sales representative'}</small></div><ArrowUpRight size={18} /></div>
      <p>{person.email}</p><div className="team-person-work"><span><b>{person.contacts}</b> Customers</span><span><b>{person.leads}</b> Open leads</span><span><b>{person.deals}</b> Open deals</span></div>
      <div className="team-person-footer"><span className={`status-pill ${person.active ? 'status-completed' : 'status-cancelled'}`}>{person.active ? 'Active' : 'Inactive'}</span><span>{person.overdue ? `${person.overdue} overdue` : `${person.tasks} follow-ups`}</span></div>
    </button>)}</div>
    {!visible.length ? <PortalEmpty title="No matching employees" copy="Try another name or access filter." /> : null}
    {selectedId && !selected ? <PortalEmpty title="Employee not found" copy="Choose an employee from the directory to review their work." /> : null}
    <div className="team-workspace">
      <article className="workspace-card team-activity"><div className="workspace-card-heading"><div><span>WORK HISTORY / {selected ? 'SELECTED EMPLOYEE' : 'COMPANY-WIDE'}</span><h3>{selected ? `${selected.display_name} · Activity` : 'Team activity'}</h3></div><Activity size={20} /></div><p className="team-helper">Recorded actions, newest first. Automated website events are labeled System / website.</p>
        {activities.loading ? <PortalLoading label="Loading activity" /> : activities.error ? <PortalError message={activities.error} retry={() => void activities.reload()} /> : <ActivityFeed rows={activities.rows} />}
        {!activities.loading && activities.rows.length === activityLimit ? <button className="portal-secondary-button" onClick={() => setActivityLimit(value => value + 25)}>Show older activity</button> : null}
      </article>
      <aside className="team-management-stack">{selected ? <>
        <article className="workspace-card"><div className="workspace-card-heading"><div><span>OWNERSHIP / {selected.rep_code}</span><h3>{selected.display_name}</h3></div><UsersRound size={20} /></div>
          <div className="team-assignment-links">{([
            ['customers', 'Customers', selected.contacts], ['leads', 'Leads', selected.leads], ['deals', 'Deals', selected.deals], ['tasks', 'Follow-ups', selected.tasks],
          ] as const).map(([path, label, count]) => <Link key={path} to={`/employee-portal/${path}?owner=${selected.id}`}><span>{label}<small>{path === 'customers' ? 'All owned contacts' : 'Open count · view all statuses'}</small></span><strong>{count}</strong><ArrowUpRight size={17} /></Link>)}</div>
          <p className="team-helper">{selected.units_sold} units sold · Last recorded activity: {formatRecordDate(selected.last_activity_at)}</p><p className="team-helper">Open a customer to transfer ownership and open work. Completed sales keep their original attribution.</p>
        </article>
        <details className="workspace-card team-access-disclosure"><summary><ShieldCheck size={18} /> Manage {selected.display_name}’s access</summary><EmployeeAccessForm key={selected.id} person={selected} onSaved={reload} /></details>
      </> : <article className="workspace-card team-selection-hint"><UsersRound size={25} /><h3>A clear view of every rep</h3><p>Select an employee above to see their assigned customers, leads, deals, and follow-ups. Administrators can update names and roles, or deactivate access.</p></article>}
        <details className="workspace-card team-access-disclosure"><summary><UserPlus size={18} /> Add an employee</summary><EmployeeAccessForm onSaved={reload} /></details>
      </aside>
    </div><p className="team-helper">Counts cover all matching records · Updated {formatRecordDate(data.as_of)} · Use Refresh for the latest changes.</p>
  </section>
}
