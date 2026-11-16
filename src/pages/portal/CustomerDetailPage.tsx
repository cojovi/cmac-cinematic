import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, BookOpenCheck, BriefcaseBusiness, CalendarClock, History, IdCard, MessageSquarePlus, Pencil, Plus, ReceiptText, Send } from 'lucide-react'
import { combineQueries, useCrmRows } from '../../hooks/useCrmRows'
import { useActor, useNow } from '../../hooks/useCrm'
import { PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import ContactAssignmentPanel from '../../components/portal/ContactAssignmentPanel'
import { ActivityComposer } from '../../components/crm/ActivityComposer'
import { ContactForm } from '../../components/crm/ContactForm'
import { Dialog } from '../../components/crm/Dialog'
import { FollowUpCard } from '../../components/crm/FollowUps'
import { Timeline } from '../../components/crm/Timeline'
import { ContactActions, DealStageBadge, Empty, LeadStageBadge, Owner, StatusBadge } from '../../components/crm/primitives'
import { dealValue, formatDate, formatMoney, relativeTime } from '../../lib/crm/pipeline'
import { activitySelect, employeeName, employeeSelect, formatRecordDate } from '../../lib/team-management'
import type { LeadPrefill } from './LeadCreatePage'

const contactSelect = '*,owner:employees!contacts_assigned_employee_id_fkey(id,display_name,rep_code),creator:employees!contacts_created_by_fkey(display_name,rep_code)'
const taskSelect = '*,contacts(display_name),deals(deal_number),owner:employees!tasks_employee_id_fkey(id,display_name)'

export default function CustomerDetailPage() {
  const { contactId = '' } = useParams()
  const actor = useActor()
  const now = useNow()
  const navigate = useNavigate()
  const byContact = { column: 'contact_id', value: contactId }
  const contact = useCrmRows('contacts', { select: contactSelect, filter: { column: 'id', value: contactId } })
  const activities = useCrmRows('activities', { select: activitySelect, filter: byContact, orderBy: 'created_at', limit: 300 })
  const tasks = useCrmRows('tasks', { select: taskSelect, filter: byContact, orderBy: 'due_at', ascending: true, limit: 200 })
  const leads = useCrmRows('leads', { filter: byContact, orderBy: 'created_at', limit: 100 })
  const deals = useCrmRows('deals', { filter: byContact, orderBy: 'created_at', limit: 100 })
  const quotes = useCrmRows('quotes', { filter: byContact, orderBy: 'created_at', limit: 100 })
  const sends = useCrmRows('marketing_sends', { select: 'id,subject,status,sent_at,created_at', filter: byContact, orderBy: 'created_at', limit: 50 })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const page = combineQueries(contact, activities, tasks, leads, deals, quotes, sends)
  const [editing, setEditing] = useState(false)

  if (page.loading) return <PortalLoading label="Opening customer" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />
  const record = contact.rows[0]
  if (!record) return <PortalEmpty title="Customer not found" copy="It may have been transferred, or it is outside the records you can access." />

  const name = String(record.display_name ?? record.email)
  const target = { contactId, ownerId: record.assigned_employee_id ? String(record.assigned_employee_id) : null }
  const address = [record.project_address, [record.city, record.state].filter(Boolean).join(', '), record.postal_code].filter(Boolean)
  const prefill: LeadPrefill = {
    origin: `${name}’s customer record`,
    prefill: { first_name: String(record.first_name ?? ''), last_name: String(record.last_name ?? ''), email: String(record.email ?? ''), phone: String(record.phone ?? ''), project_location: String(record.project_address ?? [record.city, record.state].filter(Boolean).join(', ')), source: 'referral' },
  }

  return (
    <section className="crm-page" aria-labelledby="customer-heading">
      <Link className="crm-back" to="/employee-portal/customers"><ArrowLeft size={14} />Customers</Link>
      <div className="crm-record-head">
        <div className="crm-record-title">
          <div>
            <span className="crm-eyebrow">CUSTOMER{record.company && record.company !== name ? ` / ${String(record.company).toUpperCase()}` : ''}</span>
            <h2 id="customer-heading">{name}</h2>
            <div className="crm-record-sub">
              <StatusBadge value={record.lifecycle_stage} />
              {record.email ? <a href={`mailto:${String(record.email)}`}>{String(record.email)}</a> : null}
              {record.phone ? <span>{String(record.phone)}</span> : null}
              <span>Customer since {formatDate(record.created_at)}</span>
            </div>
          </div>
          <div className="crm-record-actions">
            <ContactActions name={name} phone={record.phone} email={record.email} />
            <button className="crm-btn" type="button" onClick={() => setEditing(true)}><Pencil size={14} />Edit details</button>
            <button className="crm-btn primary" type="button" onClick={() => navigate('/employee-portal/leads/new', { state: prefill })}><Plus size={15} />New lead</button>
          </div>
        </div>
      </div>

      <div className="crm-record-grid">
        <div className="crm-stack">
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">LOG ACTIVITY</span><h3>What just happened?</h3></div><MessageSquarePlus size={18} /></div>
            <ActivityComposer target={target} subject={name} />
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">TIMELINE</span><h3>Everything with this customer</h3></div><History size={18} /></div>
            <Timeline rows={activities.rows} now={now} />
          </article>
        </div>
        <aside className="crm-stack">
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">NEXT STEP</span><h3>Follow-ups</h3></div><CalendarClock size={18} /></div>
            <FollowUpCard tasks={tasks.rows} now={now} target={target} subject={name} employees={employees.rows} />
          </article>
          <article className="crm-card record-fields">
            <div className="crm-card-head"><div><span className="crm-eyebrow">DETAILS</span><h3>Contact information</h3></div><IdCard size={18} /></div>
            <dl className="crm-facts">
              <div><dt>Email</dt><dd>{String(record.email ?? '—')}</dd></div>
              <div><dt>Phone</dt><dd>{String(record.phone ?? '—')}</dd></div>
              <div><dt>Company</dt><dd>{String(record.company ?? '—')}</dd></div>
              <div><dt>Lifecycle</dt><dd><StatusBadge value={record.lifecycle_stage} /></dd></div>
              <div className="wide"><dt>Project address</dt><dd>{address.length ? address.join('\n') : '—'}</dd></div>
              <div className="wide"><dt>Billing address</dt><dd>{String(record.billing_address ?? '—')}</dd></div>
              <div><dt>Assigned employee</dt><dd>{record.assigned_employee_id && actor.isAdmin ? <Link to={`/employee-portal/admin/employees?employee=${String(record.assigned_employee_id)}`}>{employeeName(record)}</Link> : <Owner row={record} />}</dd></div>
              <div><dt>Created by</dt><dd>{record.created_by && actor.isAdmin ? <Link to={`/employee-portal/admin/employees?employee=${String(record.created_by)}`}>{employeeName(record, 'creator', 'created_by')}</Link> : employeeName(record, 'creator', 'created_by')}</dd></div>
              <div><dt>Last updated</dt><dd>{formatRecordDate(record.updated_at)}</dd></div>
            </dl>
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">OPPORTUNITIES</span><h3>Leads</h3></div><BriefcaseBusiness size={18} /></div>
            {leads.rows.length ? <ul className="crm-linklist">{leads.rows.map((lead) => <li key={String(lead.id)}><Link className="crm-card-link" to={`/employee-portal/leads/${String(lead.id)}`}><span><strong>{String(lead.project_type ?? 'Inquiry')}</strong><small>{[lead.project_location, `created ${relativeTime(lead.created_at, now)}`].filter(Boolean).join(' · ')}</small></span><LeadStageBadge status={lead.status} /></Link></li>)}</ul> : <Empty title="No leads on file" />}
          </article>
          <article className="crm-card">
            <div className="crm-card-head"><div><span className="crm-eyebrow">SALES</span><h3>Deals & quotes</h3></div><BookOpenCheck size={18} /></div>
            {deals.rows.length || quotes.rows.length ? (
              <ul className="crm-linklist">
                {deals.rows.map((deal) => <li key={String(deal.id)}><Link className="crm-card-link" to={`/employee-portal/deals/${String(deal.id)}`}><span><strong>{String(deal.deal_number)}</strong><small>{String(deal.project_name ?? 'Deal')} · {formatMoney(dealValue(deal))}</small></span><DealStageBadge stage={deal.stage} status={deal.status} /></Link></li>)}
                {quotes.rows.map((quote) => <li key={String(quote.id)}><Link className="crm-card-link" to={`/employee-portal/quotes/${String(quote.id)}`}><span><strong><ReceiptText size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{String(quote.quote_number)}</strong><small>{formatMoney(quote.total)} · updated {relativeTime(quote.updated_at, now)}</small></span><StatusBadge value={quote.status} /></Link></li>)}
              </ul>
            ) : <Empty title="No deals yet">Convert a qualified lead, or start a sale from the New sale wizard.</Empty>}
          </article>
          {sends.rows.length ? (
            <article className="crm-card">
              <div className="crm-card-head"><div><span className="crm-eyebrow">OUTREACH</span><h3>Marketing emails</h3></div><Send size={18} /></div>
              <ul className="crm-linklist">{sends.rows.map((send) => <li key={String(send.id)}><div className="crm-card-link"><span><strong>{String(send.subject)}</strong><small>{formatRecordDate(send.sent_at ?? send.created_at)}</small></span><StatusBadge value={send.status} /></div></li>)}</ul>
            </article>
          ) : null}
          {actor.isAdmin ? (
            <article className="crm-card">
              <div className="crm-card-head"><div><span className="crm-eyebrow">ADMIN / OWNERSHIP</span><h3>Assign customer</h3></div><ArrowRightLeft size={18} /></div>
              <ContactAssignmentPanel key={`${contactId}-${String(record.assigned_employee_id)}`} record={record} />
            </article>
          ) : null}
        </aside>
      </div>
      {editing ? <Dialog title={`Edit ${name}`} eyebrow="CUSTOMER / DETAILS" variant="drawer" onClose={() => setEditing(false)}><ContactForm record={record} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} /></Dialog> : null}
    </section>
  )
}
