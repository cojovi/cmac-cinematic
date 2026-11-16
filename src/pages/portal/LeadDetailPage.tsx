import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, CalendarClock, ClipboardList, Handshake, History, Link2, MessageSquarePlus, Pencil, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { combineQueries, useCrmRows } from '../../hooks/useCrmRows'
import { useActor, useNow } from '../../hooks/useCrm'
import { useLeadMover } from '../../hooks/useLeadMover'
import { PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { LeadManagementPanel } from '../../components/portal/LeadManagementPanel'
import { ActivityComposer } from '../../components/crm/ActivityComposer'
import { Dialog } from '../../components/crm/Dialog'
import { FollowUpCard } from '../../components/crm/FollowUps'
import { Timeline } from '../../components/crm/Timeline'
import { ContactActions, DealStageBadge, HeatBadge, LeadStageBadge, Owner } from '../../components/crm/primitives'
import { contactOf } from '../../lib/crm/links'
import { canConvertLead, canDeleteLead, formatMoney, dealValue, humanize, isOpenLead, leadHeat, leadMoveTargets, leadStage, openLeadStatuses, relativeTime, type LeadStatus } from '../../lib/crm/pipeline'
import { activitySelect, employeeSelect, formatRecordDate } from '../../lib/team-management'

const leadSelect = '*,contacts(id,first_name,last_name,display_name,email,phone,company,project_address,assigned_employee_id),owner:employees!leads_assigned_employee_id_fkey(id,display_name,rep_code)'
const taskSelect = '*,contacts(display_name),owner:employees!tasks_employee_id_fkey(id,display_name)'

export default function LeadDetailPage() {
  const { leadId = '' } = useParams()
  const { employee } = useAuth()
  const actor = useActor()
  const now = useNow()
  const navigate = useNavigate()
  const lead = useCrmRows('leads', { select: leadSelect, filter: { column: 'id', value: leadId } })
  const activities = useCrmRows('activities', { select: activitySelect, filter: { column: 'lead_id', value: leadId }, orderBy: 'created_at', limit: 200 })
  const tasks = useCrmRows('tasks', { select: taskSelect, filter: { column: 'lead_id', value: leadId }, orderBy: 'due_at', ascending: true, limit: 200 })
  const deals = useCrmRows('deals', { filter: { column: 'lead_id', value: leadId }, orderBy: 'created_at', limit: 20 })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const page = combineQueries(lead, activities, tasks, deals)
  const mover = useLeadMover()
  const [editing, setEditing] = useState(false)

  if (page.loading) return <PortalLoading label="Opening lead" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />
  const record = lead.rows[0]
  if (!record) return <PortalEmpty title="Lead not found" copy="It may have been reassigned, or it is outside the records you can access." />

  const contact = contactOf(record)
  const name = String(contact.display_name ?? 'Unnamed lead')
  const status = String(record.status) as LeadStatus
  const targets = leadMoveTargets(employee?.role, employee?.id, record)
  const convertible = canConvertLead(employee?.role, employee?.id, record)
  const deal = deals.rows[0]
  const currentIndex = openLeadStatuses.indexOf(status)
  const target = { contactId: record.contact_id ? String(record.contact_id) : null, leadId, ownerId: record.assigned_employee_id ? String(record.assigned_employee_id) : null }
  const steps: LeadStatus[] = [...openLeadStatuses, 'converted']

  return (
    <section className="crm-page" aria-labelledby="lead-heading">
      <Link className="crm-back" to="/employee-portal/leads"><ArrowLeft size={14} />Lead pipeline</Link>
      <div className="crm-record-head">
        <div className="crm-record-title">
          <div>
            <span className="crm-eyebrow">LEAD / {humanize(record.source).toUpperCase()}</span>
            <h2 id="lead-heading">{name}</h2>
            <div className="crm-record-sub">
              <LeadStageBadge status={status} />
              {isOpenLead(record) ? <HeatBadge heat={leadHeat(record, now)} /> : null}
              {contact.email ? <a href={`mailto:${String(contact.email)}`}>{String(contact.email)}</a> : null}
              {contact.phone ? <span>{String(contact.phone)}</span> : null}
              <span>Created {relativeTime(record.created_at, now)}</span>
            </div>
          </div>
          <div className="crm-record-actions">
            <ContactActions name={name} phone={contact.phone} email={contact.email} />
            {actor.isAdmin && status !== 'converted' ? <button className="crm-btn" type="button" onClick={() => setEditing(true)}><Pencil size={14} />Edit lead</button> : null}
            {targets.includes('lost') ? <button className="crm-btn" type="button" onClick={() => mover.request(record, 'lost')}><XCircle size={14} />Mark lost</button> : null}
            {targets.includes('archived') && isOpenLead(record) ? <button className="crm-btn ghost" type="button" onClick={() => mover.request(record, 'archived')}><Archive size={14} />Archive</button> : null}
            {!isOpenLead(record) && targets.includes('new') ? <button className="crm-btn" type="button" onClick={() => mover.request(record, 'contacted')}><RotateCcw size={14} />Reopen</button> : null}
            {canDeleteLead(employee?.role, employee?.id, record) && !deal ? <button className="crm-btn danger" type="button" onClick={() => mover.requestDelete(record, () => navigate('/employee-portal/leads', { replace: true }))}><Trash2 size={14} />Delete</button> : null}
            {convertible ? <button className="crm-btn primary" type="button" onClick={() => mover.request(record, 'converted')}><Handshake size={15} />Convert to deal</button> : null}
            {deal ? <Link className="crm-btn primary" to={`/employee-portal/deals/${String(deal.id)}`}>Open {String(deal.deal_number)}</Link> : null}
          </div>
        </div>
        <ol className="crm-stepper" aria-label="Lead stage">
          {steps.map((step, index) => {
            const stage = leadStage(step)
            const isCurrent = status === step
            const done = status === 'converted' ? !isCurrent : currentIndex > index
            const allowed = step === 'converted' ? convertible : targets.includes(step)
            return (
              <li key={step} className={isCurrent ? 'current' : done ? 'done' : undefined}>
                <button type="button" disabled={!allowed || mover.busy} aria-current={isCurrent ? 'step' : undefined} onClick={() => mover.request(record, step)} title={allowed ? `Move to ${stage.label}` : undefined}>
                  {stage.label}<small>{stage.hint}</small>
                </button>
              </li>
            )
          })}
        </ol>
        {status === 'lost' ? <div className="crm-banner"><XCircle size={16} /><span><strong>Lost.</strong> {String(record.lost_reason ?? 'No reason recorded.')}</span></div> : null}
        {status === 'archived' ? <div className="crm-banner"><Archive size={16} /><span>Archived — hidden from the working pipeline.{actor.isAdmin ? ' Use Reopen to restore it.' : ' An administrator can restore it.'}</span></div> : null}
        {!record.assigned_employee_id ? <div className="crm-banner"><ClipboardList size={16} /><span><strong>Unassigned.</strong> {actor.isAdmin ? 'Use Edit lead to give this opportunity an owner.' : 'An administrator needs to assign this lead.'}</span></div> : null}
      </div>

      <div className="crm-record-grid">
        <div className="crm-stack">
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">LOG ACTIVITY</span><h3>What just happened?</h3></div><MessageSquarePlus size={18} /></div>
            <ActivityComposer target={target} subject={name} />
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">TIMELINE</span><h3>History</h3></div><History size={18} /></div>
            <Timeline rows={activities.rows} now={now} />
          </article>
        </div>
        <aside className="crm-stack">
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">NEXT STEP</span><h3>Follow-ups</h3></div><CalendarClock size={18} /></div>
            <FollowUpCard tasks={tasks.rows} now={now} target={target} subject={name} employees={employees.rows} />
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">DETAILS</span><h3>Project</h3></div><ClipboardList size={18} /></div>
            <dl className="crm-facts">
              <div><dt>Project type</dt><dd>{String(record.project_type ?? '—')}</dd></div>
              <div><dt>Ideal timing</dt><dd>{String(record.desired_timing ?? '—')}</dd></div>
              <div><dt>Location</dt><dd>{String(record.project_location ?? '—')}</dd></div>
              <div><dt>Source</dt><dd>{humanize(record.source) || '—'}</dd></div>
              <div className="wide"><dt>Summary</dt><dd>{String(record.summary ?? '—')}</dd></div>
              <div><dt>Owner</dt><dd><Owner row={record} /></dd></div>
              <div><dt>Last updated</dt><dd>{formatRecordDate(record.updated_at)}</dd></div>
            </dl>
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">RELATED</span><h3>Linked records</h3></div><Link2 size={18} /></div>
            <ul className="crm-linklist">
              {record.contact_id ? <li><Link className="crm-card-link" to={`/employee-portal/customers/${String(record.contact_id)}`}><span><strong>{name}</strong><small>Customer record · all leads, deals, and history</small></span></Link></li> : null}
              {deals.rows.map((row) => <li key={String(row.id)}><Link className="crm-card-link" to={`/employee-portal/deals/${String(row.id)}`}><span><strong>{String(row.deal_number)}</strong><small>{String(row.project_name ?? 'Deal')} · {formatMoney(dealValue(row))}</small></span><DealStageBadge stage={row.stage} status={row.status} /></Link></li>)}
            </ul>
          </article>
        </aside>
      </div>

      {editing ? <Dialog title={`Edit ${name}`} eyebrow="ADMIN / LEAD RECORD" variant="drawer" onClose={() => setEditing(false)}><LeadManagementPanel record={record} onSaved={() => setEditing(false)} /></Dialog> : null}
      {mover.dialogs}
    </section>
  )
}
