import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, CalendarClock, Columns3, Download, Handshake, Mail, Phone, Plus, Rows3, Search, XCircle } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { combineQueries, CRM_ROW_CAP, useCrmRows } from '../../hooks/useCrmRows'
import { useAction, useActor, useNow } from '../../hooks/useCrm'
import { useLeadMover } from '../../hooks/useLeadMover'
import { useSort } from '../../hooks/useSort'
import { PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { Kanban } from '../../components/crm/Kanban'
import { SortHeader } from '../../components/crm/SortHeader'
import { Empty, HeatBadge, LeadStageBadge, Owner, Segmented, SelectFilter } from '../../components/crm/primitives'
import { reassignLead, transferContact } from '../../lib/crm/api'
import { csvFilename, downloadCsv } from '../../lib/crm/csv'
import { contactOf } from '../../lib/crm/links'
import {
  buildSignals, canConvertLead, closedLeadStatuses, daysSince, dueLabel, formatDate, humanize, isOpenLead, leadHeat, leadMoveTargets,
  leadStage, leadStages, matchesSearch, openLeadStatuses, relativeTime, telHref, type LeadStatus, type RecordSignals,
} from '../../lib/crm/pipeline'
import { employeeSelect } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'

const leadSelect = '*,contacts(first_name,last_name,display_name,email,phone,company,assigned_employee_id),owner:employees!leads_assigned_employee_id_fkey(id,display_name,rep_code)'
type Focus = 'untouched' | 'no_next_step' | 'hot'
type SortKey = 'name' | 'stage' | 'heat' | 'project' | 'timing' | 'source' | 'owner' | 'created' | 'touch' | 'next'

const needsFirstTouch = (lead: JsonRecord, signal: RecordSignals) => lead.status === 'new' && signal.touches === 0

export default function LeadsPage() {
  const { employee } = useAuth()
  const actor = useActor()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'table' ? 'table' : 'board'
  const owner = actor.isAdmin ? params.get('owner') ?? 'all' : 'all'
  const leads = useCrmRows('leads', { select: leadSelect, orderBy: 'created_at', limit: 1000 })
  const tasks = useCrmRows('tasks', { select: 'id,lead_id,due_at,status', filter: { column: 'status', value: 'open' }, limit: 1000 })
  const activities = useCrmRows('activities', { select: 'id,lead_id,activity_type,title,created_at', orderBy: 'created_at', limit: CRM_ROW_CAP })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const page = combineQueries(leads, tasks, activities)
  const mover = useLeadMover()
  const bulk = useAction()
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('all')
  const [focus, setFocus] = useState<Focus | null>(null)
  const [stageFilter, setStageFilter] = useState<LeadStatus | 'open' | 'all'>('open')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const query = useDeferredValue(search)

  const signals = useMemo(() => buildSignals('lead_id', activities.rows, tasks.rows, now), [activities.rows, now, tasks.rows])
  const heat = useMemo(() => new Map(leads.rows.map((lead) => [String(lead.id), leadHeat(lead, now)])), [leads.rows, now])
  const sources = useMemo(() => [...new Set(leads.rows.map((lead) => String(lead.source ?? 'other')))].sort(), [leads.rows])

  const base = useMemo(() => leads.rows.filter((lead) => {
    const contact = contactOf(lead)
    if (owner === 'unassigned' ? lead.assigned_employee_id != null : owner !== 'all' && lead.assigned_employee_id !== owner) return false
    if (source !== 'all' && String(lead.source) !== source) return false
    if (!matchesSearch([contact.display_name, contact.email, contact.phone, contact.company, lead.project_type, lead.project_location, lead.summary], query)) return false
    const signal = signals.get(lead.id)
    if (focus === 'untouched' && !needsFirstTouch(lead, signal)) return false
    if (focus === 'no_next_step' && !(isOpenLead(lead) && signal.openTasks === 0)) return false
    if (focus === 'hot' && !(isOpenLead(lead) && heat.get(String(lead.id))?.level === 'hot')) return false
    return true
  }), [focus, heat, leads.rows, owner, query, signals, source])

  const openLeads = base.filter(isOpenLead)
  const closedCount = base.length - openLeads.length
  const tableRows = useMemo(() => base.filter((lead) => stageFilter === 'all' ? true : stageFilter === 'open' ? isOpenLead(lead) : lead.status === stageFilter), [base, stageFilter])
  const accessors = useMemo(() => ({
    name: (lead: JsonRecord) => String(contactOf(lead).display_name ?? ''),
    stage: (lead: JsonRecord) => leadStages.findIndex((stage) => stage.value === lead.status),
    heat: (lead: JsonRecord) => -(heat.get(String(lead.id))?.score ?? 0),
    project: (lead: JsonRecord) => String(lead.project_type ?? ''),
    timing: (lead: JsonRecord) => String(lead.desired_timing ?? ''),
    source: (lead: JsonRecord) => String(lead.source ?? ''),
    owner: (lead: JsonRecord) => lead.assigned_employee_id ? String((lead.owner as JsonRecord | null)?.display_name ?? '') : null,
    created: (lead: JsonRecord) => String(lead.created_at ?? ''),
    touch: (lead: JsonRecord) => signals.get(lead.id).lastTouchAt,
    next: (lead: JsonRecord) => signals.get(lead.id).nextTaskDue,
  }), [heat, signals])
  const table = useSort<JsonRecord, SortKey>(tableRows, accessors, { key: 'created', direction: 'desc' })
  const selectedRows = table.sorted.filter((lead) => selected.has(String(lead.id)))

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value == null) next.delete(key); else next.set(key, value)
    setParams(next, { replace: true })
  }

  function toggle(id: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function exportCsv(rows: JsonRecord[]) {
    downloadCsv(csvFilename('leads'), rows, [
      { header: 'Name', value: (lead) => contactOf(lead).display_name },
      { header: 'Email', value: (lead) => contactOf(lead).email },
      { header: 'Phone', value: (lead) => contactOf(lead).phone },
      { header: 'Stage', value: (lead) => leadStage(lead.status).label },
      { header: 'Heat', value: (lead) => heat.get(String(lead.id))?.level },
      { header: 'Project type', value: (lead) => lead.project_type },
      { header: 'Location', value: (lead) => lead.project_location },
      { header: 'Timing', value: (lead) => lead.desired_timing },
      { header: 'Source', value: (lead) => humanize(lead.source) },
      { header: 'Owner', value: (lead) => (lead.owner as JsonRecord | null)?.display_name ?? (lead.assigned_employee_id ? '' : 'Unassigned') },
      { header: 'Created', value: (lead) => formatDate(lead.created_at) },
      { header: 'Last contact', value: (lead) => formatDate(signals.get(lead.id).lastTouchAt) },
      { header: 'Next follow-up', value: (lead) => formatDate(signals.get(lead.id).nextTaskDue) },
      { header: 'Summary', value: (lead) => lead.summary },
      { header: 'Lost reason', value: (lead) => lead.lost_reason },
    ])
  }

  async function bulkMove(target: LeadStatus) {
    let moved = 0
    for (const lead of selectedRows) {
      if (!leadMoveTargets(employee?.role, employee?.id, lead).includes(target)) continue
      if (await mover.move(lead, target)) moved += 1
    }
    if (moved) setSelected(new Set())
  }

  async function bulkTransfer(employeeId: string) {
    // Ownership lives on the customer: transferring moves the contact and all of its open work together.
    const contacts = new Map(selectedRows.map((lead) => [String(lead.contact_id), lead]))
    const ok = await bulk.run(async () => {
      for (const lead of contacts.values()) {
        // The transfer endpoint compares against the customer's current owner, which can differ from the lead's.
        const contactOwner = 'assigned_employee_id' in contactOf(lead) ? contactOf(lead).assigned_employee_id : lead.assigned_employee_id
        if (contactOwner !== employeeId) await transferContact({ id: lead.contact_id, assigned_employee_id: contactOwner ?? null }, employeeId)
        else if (lead.assigned_employee_id !== employeeId) await reassignLead(lead, employeeId)
      }
    }, `${contacts.size} ${contacts.size === 1 ? 'customer' : 'customers'} and their open work transferred.`)
    if (ok) setSelected(new Set())
  }

  if (page.loading) return <PortalLoading label="Loading the lead pipeline" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />

  const counts = {
    untouched: leads.rows.filter((lead) => needsFirstTouch(lead, signals.get(lead.id))).length,
    noNext: leads.rows.filter((lead) => isOpenLead(lead) && signals.get(lead.id).openTasks === 0).length,
    hot: leads.rows.filter((lead) => isOpenLead(lead) && heat.get(String(lead.id))?.level === 'hot').length,
  }
  const filtered = Boolean(search || source !== 'all' || focus || owner !== 'all')

  function card(lead: JsonRecord) {
    const contact = contactOf(lead)
    const name = String(contact.display_name ?? 'Unnamed lead')
    const signal = signals.get(lead.id)
    const targets = leadMoveTargets(employee?.role, employee?.id, lead)
    const tel = telHref(contact.phone)
    const age = daysSince(lead.created_at, now)
    return (
      <>
        <div className="crm-kanban-card-top"><Link to={`/employee-portal/leads/${String(lead.id)}`}>{name}</Link><HeatBadge heat={heat.get(String(lead.id)) ?? leadHeat(lead, now)} /></div>
        <p>{[lead.project_type, lead.project_location].filter(Boolean).join(' · ') || 'No project details yet'}</p>
        <div className="crm-kanban-meta">
          {lead.desired_timing ? <span>{String(lead.desired_timing)}</span> : null}
          <span>{humanize(lead.source)}</span>
          <span>{age === 0 ? 'Today' : `${age}d old`}</span>
        </div>
        <div className="crm-kanban-meta">
          {needsFirstTouch(lead, signal) ? <span className="warn">No contact yet</span> : signal.lastTouchAt ? <span>Last contact {relativeTime(signal.lastTouchAt, now)}</span> : null}
          {signal.nextTaskDue ? <span className={signal.overdueTasks ? 'bad' : undefined}><CalendarClock size={12} />{dueLabel(signal.nextTaskDue, now)}</span> : <span className="warn">No next step</span>}
        </div>
        <div className="crm-kanban-foot">
          <Owner row={lead} compact />
          {tel ? <a className="crm-icon-btn" href={tel} aria-label={`Call ${name}`} title={`Call ${String(contact.phone)}`}><Phone size={13} /></a> : null}
          {contact.email ? <a className="crm-icon-btn" href={`mailto:${String(contact.email)}`} aria-label={`Email ${name}`} title={`Email ${String(contact.email)}`}><Mail size={13} /></a> : null}
          {targets.length || canConvertLead(employee?.role, employee?.id, lead) ? (
            <select className="crm-move" value="" disabled={mover.pendingIds.has(String(lead.id))} onChange={(event) => mover.request(lead, event.target.value as LeadStatus)} aria-label={`Move ${name}`}>
              <option value="">Move…</option>
              {targets.map((target) => <option key={target} value={target}>{leadStage(target).label}</option>)}
              {canConvertLead(employee?.role, employee?.id, lead) ? <option value="converted">Convert to deal</option> : null}
            </select>
          ) : null}
        </div>
      </>
    )
  }

  return (
    <section className="crm-page" aria-labelledby="leads-heading">
      <div className="crm-header">
        <div><span className="crm-eyebrow">CRM / LEAD PIPELINE</span><h2 id="leads-heading">Lead pipeline</h2><p>{actor.isAdmin ? 'Every open opportunity across the team. Drag a card to move it, or open it to log a call and book the next step.' : 'Your open opportunities. Drag a card to move it, or open it to log a call and book the next step.'}</p></div>
        <div className="crm-header-actions">
          <Segmented label="Pipeline view" value={view} onChange={(next) => setParam('view', next === 'board' ? null : next)} options={[{ value: 'board', label: 'Board', icon: <Columns3 size={14} /> }, { value: 'table', label: 'Table', icon: <Rows3 size={14} /> }]} />
          <Link className="crm-btn primary" to="/employee-portal/leads/new"><Plus size={15} />Add lead</Link>
        </div>
      </div>

      <div className="crm-toolbar">
        <label className="crm-search"><Search size={15} /><span className="sr-only">Search leads</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads" /></label>
        <SelectFilter label="Source" value={source} onChange={setSource}><option value="all">All sources</option>{sources.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</SelectFilter>
        {actor.isAdmin ? (
          <SelectFilter label="Assigned employee" value={owner} disabled={employees.loading} onChange={(value) => setParam('owner', value === 'all' ? null : value)}>
            <option value="all">Everyone</option><option value="unassigned">Unassigned</option>
            {employees.rows.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)}{person.active ? '' : ' (inactive)'}</option>)}
          </SelectFilter>
        ) : null}
        <button className="crm-btn ghost crm-right" type="button" onClick={() => exportCsv(view === 'table' ? table.sorted : base)} disabled={!base.length}><Download size={14} />Export CSV</button>
      </div>
      <div className="crm-toolbar">
        <div className="crm-chips" role="group" aria-label="Focus filters">
          <button className="crm-chip" type="button" aria-pressed={focus === 'untouched'} onClick={() => setFocus(focus === 'untouched' ? null : 'untouched')}>Needs first contact <b>{counts.untouched}</b></button>
          <button className="crm-chip" type="button" aria-pressed={focus === 'no_next_step'} onClick={() => setFocus(focus === 'no_next_step' ? null : 'no_next_step')}>No next step <b>{counts.noNext}</b></button>
          <button className="crm-chip" type="button" aria-pressed={focus === 'hot'} onClick={() => setFocus(focus === 'hot' ? null : 'hot')}>Hot <b>{counts.hot}</b></button>
        </div>
        <span className="crm-count crm-right">{openLeads.length} open{closedCount ? ` · ${closedCount} closed` : ''}{leads.rows.length === CRM_ROW_CAP ? ' · showing the newest 1,000' : ''}{activities.rows.length === CRM_ROW_CAP ? ' · contact indicators use the latest 1,000 timeline entries' : ''}</span>
      </div>

      {view === 'board' ? (
        <>
          {!openLeads.length ? <div className="crm-card"><Empty title={filtered ? 'No open leads match these filters' : 'No open leads'}>{filtered ? 'Clear a filter to see more of the pipeline.' : 'New website inquiries and manual leads will land in the New column.'}</Empty></div> : (
            <Kanban
              label="Lead pipeline board"
              items={openLeads}
              columns={openLeadStatuses.map((status) => ({ id: status, label: leadStage(status).label, emptyLabel: leadStage(status).hint }))}
              zones={[
                { id: 'converted', label: <><Handshake size={17} /><span><strong>Convert to deal</strong> — drop a ready lead here</span></> },
                { id: 'lost', label: <><XCircle size={17} /><span><strong>Mark lost</strong> — asks for a reason</span></> },
                ...(actor.isAdmin ? [{ id: 'archived', label: <><Archive size={17} /><span><strong>Archive</strong> — hide from the pipeline</span></> }] : []),
              ]}
              getId={(lead) => String(lead.id)}
              getColumn={(lead) => String(lead.status)}
              canMove={(lead, target) => target === 'converted' ? canConvertLead(employee?.role, employee?.id, lead) : leadMoveTargets(employee?.role, employee?.id, lead).includes(target as LeadStatus)}
              onMove={(lead, target) => mover.request(lead, target as LeadStatus)}
              renderCard={card}
              pendingIds={mover.pendingIds}
              attention={(lead) => needsFirstTouch(lead, signals.get(lead.id)) || signals.get(lead.id).overdueTasks > 0}
            />
          )}
          {closedCount ? <p className="crm-count">{closedCount} converted, lost, or archived {closedCount === 1 ? 'lead is' : 'leads are'} not on the board. <button className="crm-btn ghost small" type="button" onClick={() => { setStageFilter('all'); setParam('view', 'table') }}>View all in table</button></p> : null}
        </>
      ) : (
        <>
          <div className="crm-chips" role="group" aria-label="Stage">
            <button className="crm-chip" type="button" aria-pressed={stageFilter === 'open'} onClick={() => setStageFilter('open')}>Open <b>{openLeads.length}</b></button>
            {[...openLeadStatuses, ...closedLeadStatuses].map((status) => <button key={status} className="crm-chip" type="button" aria-pressed={stageFilter === status} onClick={() => setStageFilter(status)}>{leadStage(status).label} <b>{base.filter((lead) => lead.status === status).length}</b></button>)}
            <button className="crm-chip" type="button" aria-pressed={stageFilter === 'all'} onClick={() => setStageFilter('all')}>All <b>{base.length}</b></button>
          </div>
          {!table.sorted.length ? <div className="crm-card"><Empty title="No leads match these filters">Try another stage or clear the search.</Empty></div> : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead><tr>
                  <th className="check"><input type="checkbox" aria-label="Select all leads shown" checked={selectedRows.length === table.sorted.length} onChange={(event) => setSelected(event.target.checked ? new Set(table.sorted.map((lead) => String(lead.id))) : new Set())} /></th>
                  <SortHeader label="Lead" column="name" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Stage" column="stage" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Heat" column="heat" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Project" column="project" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Timing" column="timing" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Source" column="source" ariaSort={table.ariaSort} onSort={table.toggle} />
                  {actor.isAdmin ? <SortHeader label="Owner" column="owner" ariaSort={table.ariaSort} onSort={table.toggle} /> : null}
                  <SortHeader label="Created" column="created" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Last contact" column="touch" ariaSort={table.ariaSort} onSort={table.toggle} />
                  <SortHeader label="Next step" column="next" ariaSort={table.ariaSort} onSort={table.toggle} />
                </tr></thead>
                <tbody>
                  {table.sorted.map((lead) => {
                    const contact = contactOf(lead)
                    const id = String(lead.id)
                    const signal = signals.get(lead.id)
                    const name = String(contact.display_name ?? 'Unnamed lead')
                    return (
                      <tr key={id} className={selected.has(id) ? 'selected' : undefined}>
                        <td className="check"><input type="checkbox" aria-label={`Select ${name}`} checked={selected.has(id)} onChange={() => toggle(id)} /></td>
                        <td><div className="crm-cell-main"><Link to={`/employee-portal/leads/${id}`}>{name}</Link><span>{[contact.email, contact.phone].filter(Boolean).join(' · ')}</span></div></td>
                        <td><LeadStageBadge status={lead.status} /></td>
                        <td>{isOpenLead(lead) ? <HeatBadge heat={heat.get(id) ?? leadHeat(lead, now)} /> : <span className="crm-dim">—</span>}</td>
                        <td><div className="crm-cell-main"><span style={{ color: 'var(--text)', fontSize: 12.5 }}>{String(lead.project_type ?? '—')}</span><span>{String(lead.project_location ?? '')}</span></div></td>
                        <td className="crm-nowrap">{String(lead.desired_timing ?? '—')}</td>
                        <td className="crm-nowrap">{humanize(lead.source)}</td>
                        {actor.isAdmin ? <td><Owner row={lead} /></td> : null}
                        <td className="crm-nowrap" title={formatDate(lead.created_at)}>{relativeTime(lead.created_at, now)}</td>
                        <td className="crm-nowrap">{signal.lastTouchAt ? relativeTime(signal.lastTouchAt, now) : isOpenLead(lead) ? <span style={{ color: 'var(--crm-progress)' }}>None yet</span> : '—'}</td>
                        <td className="crm-nowrap">{signal.nextTaskDue ? <span style={signal.overdueTasks ? { color: 'var(--crm-bad)' } : undefined}>{dueLabel(signal.nextTaskDue, now)}</span> : isOpenLead(lead) ? <span style={{ color: 'var(--crm-progress)' }}>None booked</span> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {selectedRows.length ? (
            <div className="crm-bulkbar" role="region" aria-label="Bulk actions">
              <strong>{selectedRows.length} selected</strong>
              <select className="crm-move" style={{ marginLeft: 0, maxWidth: 150, height: 32 }} value="" disabled={mover.busy || bulk.busy} onChange={(event) => { if (event.target.value) void bulkMove(event.target.value as LeadStatus) }} aria-label="Move selected leads to a stage">
                <option value="">Move to stage…</option>
                {openLeadStatuses.map((status) => <option key={status} value={status}>{leadStage(status).label}</option>)}
              </select>
              {actor.isAdmin ? (
                <select className="crm-move" style={{ marginLeft: 0, maxWidth: 190, height: 32 }} value="" disabled={mover.busy || bulk.busy} onChange={(event) => { if (event.target.value) void bulkTransfer(event.target.value) }} aria-label="Transfer selected customers to an employee">
                  <option value="">Transfer owner…</option>
                  {employees.rows.filter((person) => person.active).map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)}</option>)}
                </select>
              ) : null}
              <button className="crm-btn small" type="button" onClick={() => exportCsv(selectedRows)}><Download size={13} />Export selected</button>
              <button className="crm-btn ghost small crm-right" type="button" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          ) : null}
        </>
      )}
      {mover.dialogs}
    </section>
  )
}
