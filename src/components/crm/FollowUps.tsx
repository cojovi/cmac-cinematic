import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Pencil, Plus, RotateCcw, X } from 'lucide-react'
import type { JsonRecord } from '../../lib/database.types'
import { closeTask, createTask, reopenTask, updateTask } from '../../lib/crm/api'
import { dueLabel, duePresets, presetDue, taskBucket, taskPriorities, toLocalInputValue, type DuePreset, type TaskPriority } from '../../lib/crm/pipeline'
import { related } from '../../lib/team-management'
import { taskRecordLink } from '../../lib/crm/links'
import { useAction, useActor } from '../../hooks/useCrm'
import { ConfirmDialog, Dialog } from './Dialog'
import { Empty } from './primitives'
import type { RecordTarget } from './ActivityComposer'

interface TaskDialogProps {
  task?: JsonRecord
  target?: RecordTarget
  employees?: JsonRecord[]
  /** When given (and there is no record target), offers an optional customer to link the follow-up to. */
  contacts?: JsonRecord[]
  defaultTitle?: string
  onClose: () => void
}

/** Create or edit a follow-up. Owner selection is only offered to administrators, who are the only ones RLS lets assign work to others. */
export function TaskDialog({ task, target, employees = [], contacts, defaultTitle = '', onClose }: TaskDialogProps) {
  const actor = useActor()
  const { run, busy } = useAction()
  const [title, setTitle] = useState(String(task?.title ?? defaultTitle))
  const [description, setDescription] = useState(String(task?.description ?? ''))
  const [due, setDue] = useState(() => toLocalInputValue(task?.due_at ? new Date(String(task.due_at)) : presetDue('tomorrow', Date.now())))
  const [priority, setPriority] = useState<TaskPriority>((task?.priority as TaskPriority) ?? 'normal')
  const [owner, setOwner] = useState(String(task?.employee_id ?? (actor.isAdmin && target?.ownerId ? target.ownerId : actor.id)))
  const [contactId, setContactId] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const dueAt = new Date(due)
    const saved = await run(async () => {
      if (task) await updateTask(String(task.id), { title: title.trim(), description: description.trim() || null, due_at: dueAt.toISOString(), priority, employee_id: owner })
      else await createTask(actor, { title, description, dueAt, priority, employeeId: owner, contactId: target?.contactId ?? (contactId || null), leadId: target?.leadId, dealId: target?.dealId })
    }, task ? 'Follow-up updated.' : 'Follow-up scheduled.')
    if (saved) onClose()
  }

  return (
    <Dialog title={task ? 'Edit follow-up' : 'Schedule a follow-up'} eyebrow="FOLLOW-UP" onClose={onClose}>
      <form className="crm-form" onSubmit={submit}>
        <label className="crm-field"><span>What needs to happen?</span><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} autoFocus placeholder="Call back about financing" /></label>
        <label className="crm-field"><span>Details (optional)</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} /></label>
        {!task && !target && contacts ? (
          <label className="crm-field"><span>Related customer (optional)</span>
            <select value={contactId} onChange={(event) => setContactId(event.target.value)}>
              <option value="">Not linked to a customer</option>
              {contacts.map((contact) => <option key={String(contact.id)} value={String(contact.id)}>{String(contact.display_name ?? contact.email)}</option>)}
            </select>
          </label>
        ) : null}
        <div className="crm-quick-picks" role="group" aria-label="Quick due dates">
          {duePresets.map((preset) => <button key={preset.value} className="crm-chip" type="button" onClick={() => setDue(toLocalInputValue(presetDue(preset.value as DuePreset, Date.now())))}>{preset.label}</button>)}
        </div>
        <div className="crm-form-grid">
          <label className="crm-field"><span>Due</span><input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} required /></label>
          <label className="crm-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>{taskPriorities.map((item) => <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}</select></label>
          {actor.isAdmin && employees.length ? (
            <label className="crm-field wide"><span>Assigned to</span>
              <select value={owner} onChange={(event) => setOwner(event.target.value)}>
                {employees.filter((person) => person.active || person.id === owner).map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        <div className="crm-form-actions">
          <button className="crm-btn ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="crm-btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : task ? 'Save changes' : 'Schedule follow-up'}</button>
        </div>
      </form>
    </Dialog>
  )
}

export function TaskItem({ task, now, employees, showRecord = false, showOwner = false }: { task: JsonRecord; now: number; employees?: JsonRecord[]; showRecord?: boolean; showOwner?: boolean }) {
  const actor = useActor()
  const { run, busy } = useAction()
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const open = task.status === 'open'
  const bucket = taskBucket(task, now)
  const link = showRecord ? taskRecordLink(task) : null
  const title = String(task.title)

  function reschedule(preset: string) {
    if (!preset) return
    void run(() => updateTask(String(task.id), { due_at: presetDue(preset as DuePreset, Date.now()).toISOString() }), 'Follow-up rescheduled.')
  }

  return (
    <li className={open ? 'crm-task' : 'crm-task closed'}>
      <button className="crm-task-check" type="button" disabled={!open || busy} onClick={() => void run(() => closeTask(actor, task, 'completed'), 'Follow-up completed.')} aria-label={open ? `Complete ${title}` : `${title} is ${String(task.status)}`}><Check size={13} /></button>
      <div className="crm-task-body">
        <strong>{title}</strong>
        <div className="crm-task-meta">
          {open ? <span className={bucket === 'overdue' ? 'late' : bucket === 'today' ? 'soon' : undefined}>{dueLabel(task.due_at, now)}</span> : <span>{task.status === 'cancelled' ? 'Cancelled' : 'Completed'}</span>}
          {task.priority && task.priority !== 'normal' ? <span className={`crm-priority ${String(task.priority)}`}>{String(task.priority)}</span> : null}
          {link ? <Link to={link.to}>{link.label}</Link> : null}
          {showOwner ? <span>{String(related(task, 'owner')?.display_name ?? 'Unavailable')}</span> : null}
        </div>
      </div>
      <div className="crm-task-actions">
        {open ? (
          <>
            <select className="crm-move" value="" disabled={busy} onChange={(event) => reschedule(event.target.value)} aria-label={`Reschedule ${title}`}>
              <option value="">Snooze…</option>
              {duePresets.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
            </select>
            <button className="crm-icon-btn" type="button" onClick={() => setEditing(true)} aria-label={`Edit ${title}`} title="Edit"><Pencil size={13} /></button>
            <button className="crm-icon-btn" type="button" disabled={busy} onClick={() => setCancelling(true)} aria-label={`Cancel ${title}`} title="Cancel follow-up"><X size={14} /></button>
          </>
        ) : <button className="crm-icon-btn" type="button" disabled={busy} onClick={() => void run(() => reopenTask(task), 'Follow-up reopened.')} aria-label={`Reopen ${title}`} title="Reopen"><RotateCcw size={13} /></button>}
      </div>
      {task.description && open ? <p className="crm-task-desc">{String(task.description)}</p> : null}
      {editing ? <TaskDialog task={task} employees={employees} onClose={() => setEditing(false)} /> : null}
      {cancelling ? <ConfirmDialog title="Cancel this follow-up?" body={`“${title}” will be closed as cancelled and recorded on the timeline.`} confirmLabel="Cancel follow-up" danger busy={busy} onClose={() => setCancelling(false)} onConfirm={() => void run(() => closeTask(actor, task, 'cancelled'), 'Follow-up cancelled.').then(() => setCancelling(false))} /> : null}
    </li>
  )
}

/** Follow-ups for a single record, with a one-line quick add. */
export function FollowUpCard({ tasks, now, target, subject, employees }: { tasks: JsonRecord[]; now: number; target: RecordTarget; subject: string; employees?: JsonRecord[] }) {
  const actor = useActor()
  const { run, busy } = useAction()
  const [title, setTitle] = useState('')
  const [preset, setPreset] = useState<DuePreset>('tomorrow')
  const [dialog, setDialog] = useState(false)
  const open = tasks.filter((task) => task.status === 'open').sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))
  const closed = tasks.filter((task) => task.status !== 'open').slice(0, 3)

  async function quickAdd(event: FormEvent) {
    event.preventDefault()
    const saved = await run(() => createTask(actor, {
      title: title.trim() || `Follow up with ${subject}`, dueAt: presetDue(preset, Date.now()), priority: 'normal',
      employeeId: actor.isAdmin && target.ownerId ? target.ownerId : actor.id,
      contactId: target.contactId, leadId: target.leadId, dealId: target.dealId,
    }), 'Follow-up scheduled.')
    if (saved) setTitle('')
  }

  return (
    <>
      {open.length ? <ul className="crm-tasks">{open.map((task) => <TaskItem key={String(task.id)} task={task} now={now} employees={employees} showOwner={actor.isAdmin} />)}</ul>
        : <Empty title="No next step booked">Every open record should have one. Add it below.</Empty>}
      <form className="crm-composer-row" onSubmit={quickAdd} style={{ marginTop: 12 }}>
        <input className="crm-input crm-grow" style={{ flex: '1 1 150px' }} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`Follow up with ${subject}`} aria-label="New follow-up" maxLength={200} />
        <select className="crm-move" style={{ height: 38, maxWidth: 150, marginLeft: 0 }} value={preset} onChange={(event) => setPreset(event.target.value as DuePreset)} aria-label="Due">
          {duePresets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button className="crm-btn" type="submit" disabled={busy}><Plus size={14} />Add</button>
        <button className="crm-btn ghost" type="button" onClick={() => setDialog(true)}>More options</button>
      </form>
      {closed.length ? <ul className="crm-tasks" style={{ marginTop: 10 }}>{closed.map((task) => <TaskItem key={String(task.id)} task={task} now={now} />)}</ul> : null}
      {dialog ? <TaskDialog target={target} employees={employees} defaultTitle={title} onClose={() => setDialog(false)} /> : null}
    </>
  )
}
