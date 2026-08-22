import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, CheckCircle2, FileText, MessageSquarePlus, Save, ShieldCheck } from 'lucide-react'
import { usePortalRows } from '../../hooks/usePortalRows'
import { PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { useAuth } from '../../auth/useAuth'
import { supabase } from '../../lib/supabase'
import type { PublicTableName, TablesInsert } from '../../lib/database.types'

type DetailResource = 'leads' | 'customers' | 'deals'

const tableByResource: Record<DetailResource, PublicTableName> = { leads: 'leads', customers: 'contacts', deals: 'deals' }
const paramByResource: Record<DetailResource, string> = { leads: 'leadId', customers: 'contactId', deals: 'dealId' }
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export default function ResourceDetailPage({ resource }: { resource: DetailResource }) {
  const params = useParams()
  const id = params[paramByResource[resource]] ?? ''
  const { employee, previewMode } = useAuth()
  const recordQuery = usePortalRows(tableByResource[resource], { filter: { column: 'id', value: id } })
  const activityFilter = resource === 'customers' ? 'contact_id' : resource === 'leads' ? 'lead_id' : 'deal_id'
  const activityQuery = usePortalRows('activities', { filter: { column: activityFilter, value: id }, orderBy: 'created_at', limit: 50 })
  const dealUnitsQuery = usePortalRows('deal_units', { filter: { column: 'deal_id', value: id }, orderBy: 'created_at', limit: 50 })
  const contractsQuery = usePortalRows('contracts', { filter: { column: 'deal_id', value: id }, orderBy: 'created_at', limit: 50 })
  const [note, setNote] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const record = recordQuery.rows[0]
  const title = useMemo(() => String(record?.display_name ?? record?.deal_number ?? record?.project_type ?? 'Record'), [record])

  async function addNote(event: FormEvent) {
    event.preventDefault()
    if (!note.trim() || previewMode || !supabase || !employee) return
    const activity: TablesInsert<'activities'> = {
      contact_id: resource === 'customers' ? id : String(record?.contact_id ?? '') || null,
      lead_id: resource === 'leads' ? id : null,
      deal_id: resource === 'deals' ? id : null,
      employee_id: employee.id,
      activity_type: 'note_added',
      title: 'Note added',
      description: note.trim(),
    }
    const { error } = await supabase.from('activities').insert(activity)
    setActionMessage(error?.message ?? 'Note saved to the timeline.')
    if (!error) { setNote(''); await activityQuery.reload() }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault()
    if (!taskTitle.trim() || !dueAt || previewMode || !supabase || !employee) return
    const contactId = resource === 'customers' ? id : resource === 'leads' ? String(record?.contact_id ?? '') : String(record?.contact_id ?? '')
    const { error } = await supabase.from('tasks').insert({
      employee_id: employee.id,
      contact_id: contactId || null,
      lead_id: resource === 'leads' ? id : null,
      deal_id: resource === 'deals' ? id : null,
      title: taskTitle.trim(),
      due_at: new Date(dueAt).toISOString(),
    })
    setActionMessage(error?.message ?? 'Follow-up added to your queue.')
    if (!error) { setTaskTitle(''); setDueAt('') }
  }

  async function markSold() {
    if (previewMode || !supabase || resource !== 'deals') return
    if (!window.confirm('Mark this deal sold and create its permanent unit-attribution records? This cannot be reversed from the portal.')) return
    const { data, error: functionError } = await supabase.functions.invoke('complete-unit-sale', { body: { deal_id: id, override_reason: overrideReason.trim() || undefined } })
    if (functionError) setActionMessage(functionError.message)
    else { setActionMessage(String((data as { message?: string })?.message ?? 'Deal completion recorded.')); await recordQuery.reload() }
  }

  if (recordQuery.loading || activityQuery.loading || dealUnitsQuery.loading || contractsQuery.loading) return <PortalLoading label="Opening record" />
  if (recordQuery.error || activityQuery.error || dealUnitsQuery.error || contractsQuery.error) return <PortalError message={recordQuery.error ?? activityQuery.error ?? dealUnitsQuery.error ?? contractsQuery.error ?? 'Unable to open record.'} retry={() => void recordQuery.reload()} />
  if (!record) return <PortalEmpty title="Record not found" copy="It may have been removed or is outside your assigned RLS scope." />

  return (
    <section className="record-detail-page">
      <Link className="portal-text-button detail-back" to={`/employee-portal/${resource}`}><ArrowLeft size={15} /> Back to {resource}</Link>
      <div className="record-hero"><div><span>{resource.toUpperCase()} / {id.slice(0, 8)}</span><h2>{title}</h2><p>{String(record.email ?? record.project_location ?? record.project_name ?? 'CMAC transaction record')}</p></div><span className={`status-pill status-${String(record.status ?? record.lifecycle_stage)}`}>{String(record.status ?? record.lifecycle_stage).replaceAll('_', ' ')}</span></div>
      {previewMode ? <div className="configuration-state"><ShieldCheck size={17} /><div><strong>Local preview is read-only</strong><span>Connect Supabase and sign in to save timeline notes or follow-ups.</span></div></div> : null}
      {actionMessage ? <p className="record-action-message" role="status">{actionMessage}</p> : null}
      <div className="record-detail-grid">
        <article className="workspace-card record-fields"><div className="workspace-card-heading"><div><span>RECORD / DETAILS</span><h3>Current information</h3></div><FileText size={20} /></div><dl>{Object.entries(record).filter(([key, value]) => !['id', 'contacts', 'metadata'].includes(key) && value !== null && typeof value !== 'object').slice(0, 14).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(value)}</dd></div>)}</dl></article>
        <aside className="record-actions-stack">
          <form className="workspace-card record-action-form" onSubmit={addNote}><div className="workspace-card-heading"><div><span>TIMELINE / NOTE</span><h3>Add context</h3></div><MessageSquarePlus size={19} /></div><label><span>Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Customer conversation, site context, or next step" required /></label><button className="portal-primary-button" disabled={previewMode} type="submit"><Save size={15} /> Save note</button></form>
          <form className="workspace-card record-action-form" onSubmit={addTask}><div className="workspace-card-heading"><div><span>FOLLOW-UP / TASK</span><h3>Schedule action</h3></div><CalendarPlus size={19} /></div><label><span>Task</span><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} required /></label><label><span>Due</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required /></label><button className="portal-secondary-button" disabled={previewMode} type="submit"><CalendarPlus size={15} /> Add follow-up</button></form>
          {resource === 'deals' ? <article className="workspace-card record-action-form sale-completion-card"><div className="workspace-card-heading"><div><span>ATTRIBUTION / FINAL</span><h3>Mark deal sold</h3></div><CheckCircle2 size={19} /></div><dl><div><dt>Confirmed units</dt><dd>{dealUnitsQuery.rows.filter((unit) => unit.source !== 'mock' && unit.confirmed_at).length} / {dealUnitsQuery.rows.length}</dd></div><div><dt>Completed contracts</dt><dd>{contractsQuery.rows.filter((contract) => contract.status === 'completed').length}</dd></div></dl>{employee?.role === 'admin' && contractsQuery.rows.every((contract) => contract.status !== 'completed') ? <label><span>Admin override reason · minimum 10 characters</span><textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} rows={3} /></label> : null}<button className="portal-primary-button" disabled={previewMode || dealUnitsQuery.rows.length === 0 || dealUnitsQuery.rows.some((unit) => unit.source === 'mock' || !unit.confirmed_at) || (contractsQuery.rows.every((contract) => contract.status !== 'completed') && !(employee?.role === 'admin' && overrideReason.trim().length >= 10))} type="button" onClick={() => void markSold()}><CheckCircle2 size={15} /> Create unit attribution</button></article> : null}
        </aside>
        <article className="workspace-card record-timeline"><div className="workspace-card-heading"><div><span>ACTIVITY / AUDITABLE</span><h3>Timeline</h3></div><MessageSquarePlus size={19} /></div>{activityQuery.rows.length === 0 ? <PortalEmpty title="No timeline activity" copy="Notes, status changes, sends, and signatures will collect here." /> : <div className="timeline-list">{activityQuery.rows.map((activity) => <div key={String(activity.id)}><span /><div><strong>{String(activity.title)}</strong><p>{String(activity.description ?? '')}</p><time>{dateTime.format(new Date(String(activity.created_at)))}</time></div></div>)}</div>}</article>
      </div>
    </section>
  )
}
