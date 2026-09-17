import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Clock3, Plus, Search, X } from 'lucide-react'
import { usePortalRows } from '../../hooks/usePortalRows'
import { ComingSoonBanner, PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import { nestedLabel, resourceConfigs, type ResourceName } from './resource-config'
import { employeeName, employeeSelect } from '../../lib/team-management'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function titleFor(resource: ResourceName, row: Record<string, unknown>) {
  if (resource === 'leads') return nestedLabel(row) || String(row.project_type ?? 'New inquiry')
  if (resource === 'customers') return String(row.display_name ?? row.email)
  if (resource === 'tasks') return String(row.title)
  if (resource === 'deals') return String(row.deal_number ?? row.project_name)
  if (resource === 'quotes') return String(row.quote_number)
  return `${nestedLabel(row) || 'Contract'} / ${String(row.provider ?? 'DocuSign')}`
}

function subtitleFor(resource: ResourceName, row: Record<string, unknown>) {
  if (resource === 'leads') return [row.project_type, row.project_location, row.desired_timing].filter(Boolean).join(' · ')
  if (resource === 'customers') return [row.email, row.phone, row.city, row.state].filter(Boolean).join(' · ')
  if (resource === 'tasks') return [nestedLabel(row), row.description].filter(Boolean).join(' · ')
  if (resource === 'deals') return [nestedLabel(row), row.project_name].filter(Boolean).join(' · ')
  if (resource === 'quotes') return `${nestedLabel(row)} · ${money.format(Number(row.total ?? 0))}`
  return row.provider_envelope_id ? `Envelope ${String(row.provider_envelope_id)}` : 'Envelope not sent'
}

export default function ResourceListPage({ resource }: { resource: ResourceName }) {
  const [currentTime] = useState(() => Date.now())
  const config = resourceConfigs[resource]
  const { previewMode, employee } = useAuth()
  const [params, setParams] = useSearchParams()
  const owner = employee?.role === 'admin' ? params.get('owner') ?? 'all' : 'all'
  const ownerColumn = resource === 'leads' || resource === 'customers' ? 'assigned_employee_id' : resource === 'deals' ? 'sales_rep_id' : 'employee_id'
  const ownerTable = resource === 'customers' ? 'contacts' : resource
  const [limit, setLimit] = useState(250)
  const query = usePortalRows(config.table, { select: `${config.select},owner:employees!${ownerTable}_${ownerColumn}_fkey(display_name,rep_code)`, orderBy: config.orderBy, ascending: resource === 'tasks', limit, filter: owner === 'all' ? undefined : { column: ownerColumn, value: owner === 'unassigned' ? null : owner } })
  const employees = usePortalRows('employees', { enabled: employee?.role === 'admin', select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 1000 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [pendingTask, setPendingTask] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const statuses = useMemo(() => Array.from(new Set(query.rows.map((row) => String(row.status ?? row.lifecycle_stage ?? 'unknown')))), [query.rows])
  const visible = useMemo(() => query.rows.filter((row) => {
    const rowStatus = String(row.status ?? row.lifecycle_stage ?? 'unknown')
    return (status === 'all' || rowStatus === status) && JSON.stringify(row).toLowerCase().includes(deferredSearch)
  }), [deferredSearch, query.rows, status])

  async function updateTask(id: string, nextStatus: 'completed' | 'cancelled') {
    if (previewMode || !supabase || pendingTask) return
    if (nextStatus === 'cancelled' && !window.confirm('Cancel this follow-up? This action is recorded but the task can no longer be completed.')) return
    setPendingTask(id); setMutationError(null)
    try {
      const { data, error } = await supabase.from('tasks').update({ status: nextStatus, completed_at: nextStatus === 'completed' ? new Date().toISOString() : null }).eq('id', id).eq('status', 'open').select('id')
      if (error) setMutationError(error.message)
      else if (!data?.length) setMutationError('This follow-up changed or is no longer accessible. Refresh and try again.')
      else await query.reload()
    } catch { setMutationError('Unable to save the follow-up. Please try again.') }
    finally { setPendingTask(null) }
  }

  if (query.loading) return <PortalLoading label={`Loading ${config.title.toLowerCase()}`} />
  if (query.error) return <PortalError message={query.error} retry={() => void query.reload()} />

  return (
    <section className="portal-library-view" aria-labelledby={`${resource}-heading`}>
      <div className="workspace-view-heading"><div><span>{config.eyebrow}</span><h2 id={`${resource}-heading`}>{config.title}</h2><p>{config.copy}</p></div><div className="workspace-heading-actions">{resource === 'leads' ? <Link className="portal-primary-button" to="/employee-portal/leads/new"><Plus size={15} /> Add lead</Link> : null}<span className="workspace-live-chip"><config.Icon size={14} /> {query.rows.length} records</span></div></div>
      {resource === 'contracts' ? <ComingSoonBanner title="DocuSign contract delivery is paused for this release" copy="Contract records remain visible, but envelope creation, signing, webhooks, and signed-PDF retrieval will be enabled in a later iteration." /> : null}
      <div className="resource-toolbar">
        <label className="workspace-search"><Search size={16} /><span className="sr-only">Search {resource}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${resource}`} /></label>
        <label className="resource-status-filter"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
        {employee?.role === 'admin' ? <label className="resource-status-filter"><span>Assigned employee</span><select value={owner} disabled={employees.loading || Boolean(employees.error)} onChange={event => { setParams(event.target.value === 'all' ? {} : { owner: event.target.value }); setLimit(250) }}><option value="all">All employees</option>{['customers','leads'].includes(resource) ? <option value="unassigned">Unassigned</option> : null}{employees.rows.map(person => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)}{person.active ? '' : ' (inactive)'}</option>)}</select></label> : null}
      </div>
      {employees.error ? <PortalError message={employees.error} retry={() => void employees.reload()} /> : null}
      <p className="team-helper">{visible.length} shown · Search and status filters apply to the {query.rows.length} loaded records{query.rows.length === limit ? '. Load more below to search older records.' : '.'}</p>
      {mutationError ? <PortalError message={mutationError} /> : null}
      {visible.length === 0 ? <PortalEmpty title={config.emptyTitle} copy={search || status !== 'all' || owner !== 'all' ? 'No records match the current filters.' : config.emptyCopy} /> : (
        <div className="resource-table" role="list">
          {visible.map((row) => {
            const id = String(row.id)
            const rowStatus = String(row.status ?? row.lifecycle_stage ?? 'unknown')
            const content = <><span className="resource-type-icon"><config.Icon size={18} /></span><div className="resource-primary"><strong>{titleFor(resource, row)}</strong><span>{subtitleFor(resource, row)}</span><small className="resource-owner">Assigned to {employeeName(row, 'owner', ownerColumn)}</small></div><span className={`status-pill status-${rowStatus}`}>{rowStatus.replaceAll('_', ' ')}</span><time>{row[config.orderBy] ? date.format(new Date(String(row[config.orderBy]))) : '—'}</time></>
            return resource === 'tasks' ? (
              <article key={id} className={new Date(String(row.due_at)).getTime() < currentTime && rowStatus === 'open' ? 'resource-row overdue' : 'resource-row'} role="listitem">{content}<div className="resource-row-actions"><button type="button" disabled={previewMode || Boolean(pendingTask) || rowStatus !== 'open'} onClick={() => void updateTask(id, 'completed')} aria-label={`Complete ${titleFor(resource, row)}`}><Check size={15} /></button><button type="button" disabled={previewMode || Boolean(pendingTask) || rowStatus !== 'open'} onClick={() => void updateTask(id, 'cancelled')} aria-label={`Cancel ${titleFor(resource, row)}`}><X size={15} /></button></div></article>
            ) : config.detailPath ? <div key={id} role="listitem"><Link className="resource-row" to={`${config.detailPath}/${id}`}>{content}<Clock3 size={16} /></Link></div> : <article key={id} className="resource-row" role="listitem">{content}</article>
          })}
        </div>
      )}
      {query.rows.length === limit ? <button className="portal-secondary-button" onClick={() => setLimit(value => value + 250)}>Load more records</button> : null}
    </section>
  )
}
