import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, BriefcaseBusiness, CalendarClock, CircleDollarSign, Filter, PackageCheck, PhoneOutgoing, Plus, Radar, UsersRound } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { combineQueries, useCrmRows } from '../../hooks/useCrmRows'
import { useActor, useNow } from '../../hooks/useCrm'
import { usePortalSummary } from '../../hooks/usePortalSummary'
import { PortalError, PortalLoading } from '../../components/portal/AsyncState'
import InventoryHeadline from '../../components/portal/InventoryHeadline'
import { TaskDialog, TaskItem } from '../../components/crm/FollowUps'
import { Timeline } from '../../components/crm/Timeline'
import { BarList, ContactActions, Empty, HeatBadge } from '../../components/crm/primitives'
import { contactOf } from '../../lib/crm/links'
import {
  buildSignals, dealValue, formatMoney, humanize, isOpenDeal, isOpenLead, leadHeat, leadStage, openLeadStatuses, relativeTime,
  sourceBreakdown, taskBucket, weightedDealValue,
} from '../../lib/crm/pipeline'
import { activitySelect, employeeSelect, formatRecordDate } from '../../lib/team-management'

const taskSelect = '*,contacts(display_name),deals(deal_number),owner:employees!tasks_employee_id_fkey(id,display_name)'

export default function DashboardPage() {
  const { employee, previewMode } = useAuth()
  const actor = useActor()
  const now = useNow()
  const leads = useCrmRows('leads', { select: '*,contacts(display_name,email,phone)', orderBy: 'created_at', limit: 1000 })
  const tasks = useCrmRows('tasks', { select: taskSelect, filter: { column: 'status', value: 'open' }, orderBy: 'due_at', ascending: true, limit: 1000 })
  const deals = useCrmRows('deals', { select: 'id,stage,status,base_amount,delivery_amount', limit: 1000 })
  const activities = useCrmRows('activities', { select: activitySelect, orderBy: 'created_at', limit: 500 })
  const sales = useCrmRows('unit_sales', { select: 'id', limit: 1000 })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const page = combineQueries(leads, tasks, deals, activities, sales)
  const [adding, setAdding] = useState(false)

  const signals = useMemo(() => buildSignals('lead_id', activities.rows, tasks.rows, now), [activities.rows, now, tasks.rows])
  const myTasks = useMemo(() => tasks.rows.filter((task) => task.employee_id === actor.id), [actor.id, tasks.rows])
  // Administrators see their own queue here; the team's workload is in the snapshot below.
  const due = useMemo(() => myTasks.filter((task) => ['overdue', 'today'].includes(taskBucket(task, now))), [myTasks, now])
  const openLeads = useMemo(() => leads.rows.filter(isOpenLead), [leads.rows])
  const waiting = useMemo(() => openLeads.filter((lead) => lead.status === 'new' && signals.get(lead.id).touches === 0).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))), [openLeads, signals])

  if (page.loading) return <PortalLoading label="Building your sales command center" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />

  const openDeals = deals.rows.filter(isOpenDeal)
  const pipeline = openDeals.reduce((sum, deal) => sum + dealValue(deal), 0)
  const weighted = openDeals.reduce((sum, deal) => sum + weightedDealValue(deal), 0)
  const allDue = tasks.rows.filter((task) => new Date(String(task.due_at)).getTime() <= now)
  const overdueMine = myTasks.filter((task) => taskBucket(task, now) === 'overdue').length
  const hour = new Date(now).getHours()
  const scope = actor.isAdmin ? 'Company' : 'Your'

  return (
    <section className="crm-page" aria-labelledby="dashboard-heading">
      <div className="crm-header">
        <div>
          <span className="crm-eyebrow">{previewMode ? 'LOCAL PREVIEW / SAMPLE DATA' : actor.isAdmin ? 'LIVE / COMPANY-WIDE RECORDS' : 'LIVE / ASSIGNED RECORDS'}</span>
          <h2 id="dashboard-heading">Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, {employee?.first_name}.</h2>
          <p>{due.length ? `${due.length} follow-up${due.length === 1 ? '' : 's'} need you today${overdueMine ? `, ${overdueMine} overdue` : ''}.` : 'No follow-ups due right now.'} {waiting.length ? `${waiting.length} new lead${waiting.length === 1 ? ' is' : 's are'} waiting on a first contact.` : 'Every new lead has been contacted.'}</p>
        </div>
        <div className="crm-header-actions">
          <button className="crm-btn" type="button" onClick={() => setAdding(true)}><CalendarClock size={14} />Follow-up</button>
          <Link className="crm-btn" to="/employee-portal/leads/new"><Plus size={14} />Add lead</Link>
          <Link className="crm-btn primary" to="/employee-portal/sales/new"><Plus size={15} />Start new sale</Link>
        </div>
      </div>

      <div className="crm-metrics">
        <Link className="crm-metric" to="/employee-portal/leads"><span>{scope} open leads<BriefcaseBusiness size={16} /></span><strong>{openLeads.length}</strong><small>{waiting.length} waiting on first contact</small></Link>
        <Link className={allDue.length ? 'crm-metric alert' : 'crm-metric'} to={actor.isAdmin ? '/employee-portal/tasks?owner=all' : '/employee-portal/tasks'}><span>{actor.isAdmin ? 'Team follow-ups due' : 'Follow-ups due'}<CalendarClock size={16} /></span><strong>{allDue.length}</strong><small>{tasks.rows.length} open in total</small></Link>
        <Link className="crm-metric" to="/employee-portal/deals" title="Weighted forecast is each open deal's value multiplied by its stage likelihood."><span>Open pipeline<CircleDollarSign size={16} /></span><strong>{formatMoney(pipeline)}</strong><small>{openDeals.length} {openDeals.length === 1 ? 'deal' : 'deals'} · {formatMoney(weighted)} weighted</small></Link>
        <div className="crm-metric"><span>Units sold<PackageCheck size={16} /></span><strong>{sales.rows.length}</strong><small>{deals.rows.filter((deal) => deal.status === 'won').length} deals won</small></div>
      </div>

      <div className="dashboard-inventory-strip"><InventoryHeadline compact /></div>

      <div className="crm-two">
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">DO NEXT</span><h3>Your follow-ups for today</h3></div><CalendarClock size={18} /></div>
          {due.length ? <ul className="crm-tasks">{due.slice(0, 6).map((task) => <TaskItem key={String(task.id)} task={task} now={now} employees={employees.rows} showRecord />)}</ul> : <Empty title="Nothing due">You are caught up. Upcoming follow-ups are in the queue.</Empty>}
          <p className="crm-card-foot"><Link to="/employee-portal/tasks">Open the full queue</Link>{due.length > 6 ? ` · ${due.length - 6} more due today` : ''}</p>
        </article>
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">SPEED TO LEAD</span><h3>Waiting on first contact</h3></div><PhoneOutgoing size={18} /></div>
          {waiting.length ? (
            <ul className="crm-linklist">{waiting.slice(0, 6).map((lead) => {
              const contact = contactOf(lead)
              const name = String(contact.display_name ?? 'Unnamed lead')
              return (
                <li key={String(lead.id)}><div className="crm-card-link">
                  <span><Link to={`/employee-portal/leads/${String(lead.id)}`}><strong>{name}</strong></Link><small>{[lead.project_type, lead.project_location].filter(Boolean).join(' · ')} · waiting {relativeTime(lead.created_at, now).replace(' ago', '')}{lead.assigned_employee_id ? '' : ' · unassigned'}</small></span>
                  <HeatBadge heat={leadHeat(lead, now)} />
                  <ContactActions name={name} phone={contact.phone} email={contact.email} size={13} />
                </div></li>
              )
            })}</ul>
          ) : <Empty title="No one is waiting">Every new lead has at least one logged contact.</Empty>}
          <p className="crm-card-foot">The sooner a new inquiry hears back, the more likely it converts. {waiting.length > 6 ? <Link to="/employee-portal/leads">See all {waiting.length}</Link> : null}</p>
        </article>
      </div>

      <div className="crm-three">
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">PIPELINE</span><h3>Open leads by stage</h3></div><Filter size={18} /></div>
          <BarList data={openLeadStatuses.map((status) => ({ label: leadStage(status).label, value: openLeads.filter((lead) => lead.status === status).length }))} />
          <p className="crm-card-foot"><Link to="/employee-portal/leads">Open the board</Link> · <Link to="/employee-portal/reports">Conversion report</Link></p>
        </article>
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">DEMAND</span><h3>Where leads come from</h3></div><Radar size={18} /></div>
          <BarList data={sourceBreakdown(leads.rows).slice(0, 6).map((row) => ({ label: humanize(row.source), value: row.total, note: row.converted ? `${row.converted} converted` : undefined }))} emptyLabel="No leads yet" />
        </article>
        <article className="crm-card">
          <div className="crm-card-head"><div><span className="crm-eyebrow">ACTIVITY</span><h3>Latest movement</h3></div><Activity size={18} /></div>
          <Timeline rows={activities.rows.slice(0, 5)} now={now} showContext filterable={false} />
        </article>
      </div>

      {actor.isAdmin ? <TeamSnapshot /> : null}
      {adding ? <TaskDialog employees={employees.rows} onClose={() => setAdding(false)} /> : null}
    </section>
  )
}

function TeamSnapshot() {
  const summary = usePortalSummary('admin_team_overview')
  if (summary.loading) return null
  if (summary.error || !summary.data) return <div className="crm-banner">Team snapshot is unavailable right now. {summary.error}</div>
  const people = summary.data.employees.filter((person) => person.active)
  return (
    <article className="crm-card">
      <div className="crm-card-head"><div><span className="crm-eyebrow">ADMIN / TEAM</span><h3>Workload by person</h3></div><UsersRound size={18} /></div>
      {summary.data.unassigned_leads || summary.data.unassigned_contacts ? <div className="crm-banner" style={{ marginBottom: 12 }}><span><strong>Needs an owner:</strong> <Link to="/employee-portal/leads?owner=unassigned&view=table">{summary.data.unassigned_leads} open {summary.data.unassigned_leads === 1 ? 'lead' : 'leads'}</Link> · <Link to="/employee-portal/customers?owner=unassigned">{summary.data.unassigned_contacts} {summary.data.unassigned_contacts === 1 ? 'customer' : 'customers'}</Link></span></div> : null}
      <div className="crm-table-wrap" style={{ border: 0, background: 'transparent' }}>
        <table className="crm-table" style={{ minWidth: 620 }}>
          <thead><tr><th>Employee</th><th className="num">Open leads</th><th className="num">Open deals</th><th className="num">Follow-ups</th><th className="num">Overdue</th><th className="num">Units sold</th><th>Last activity</th></tr></thead>
          <tbody>{people.map((person) => (
            <tr key={person.id}>
              <td><div className="crm-cell-main"><Link to={`/employee-portal/admin/employees?employee=${person.id}`}>{person.display_name}</Link><span>{person.role === 'admin' ? 'Administrator' : 'Sales representative'}</span></div></td>
              <td className="num"><Link to={`/employee-portal/leads?owner=${person.id}`}>{person.leads}</Link></td>
              <td className="num">{person.deals}</td>
              <td className="num">{person.tasks}</td>
              <td className="num" style={person.overdue ? { color: 'var(--crm-bad)', fontWeight: 700 } : undefined}>{person.overdue}</td>
              <td className="num">{person.units_sold}</td>
              <td className="crm-nowrap">{formatRecordDate(person.last_activity_at)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </article>
  )
}
