import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { combineQueries, useCrmRows } from '../../hooks/useCrmRows'
import { useActor, useNow } from '../../hooks/useCrm'
import { PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { TaskDialog, TaskItem } from '../../components/crm/FollowUps'
import { Empty, SelectFilter } from '../../components/crm/primitives'
import { matchesSearch, taskBucket, taskBuckets, taskPriorities, type TaskBucket } from '../../lib/crm/pipeline'
import { employeeSelect, related } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'

const taskSelect = '*,contacts(display_name),deals(deal_number),owner:employees!tasks_employee_id_fkey(id,display_name)'
const priorityRank = (task: JsonRecord) => taskPriorities.indexOf(String(task.priority) as typeof taskPriorities[number])

export default function TasksPage() {
  const actor = useActor()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  // Administrators land on their own queue; the team-management screen deep-links to a specific person.
  const owner = actor.isAdmin ? params.get('owner') ?? 'mine' : 'mine'
  const creating = params.get('new') === '1'
  const tasks = useCrmRows('tasks', { select: taskSelect, orderBy: 'due_at', ascending: true, limit: 1000 })
  const employees = useCrmRows('employees', { enabled: actor.isAdmin, select: employeeSelect, orderBy: 'display_name', ascending: true, limit: 500 })
  const contacts = useCrmRows('contacts', { enabled: creating, select: 'id,display_name,email', orderBy: 'display_name', ascending: true, limit: 1000 })
  const page = combineQueries(tasks)
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('all')
  const [showClosed, setShowClosed] = useState(false)
  const query = useDeferredValue(search)

  const visible = useMemo(() => tasks.rows.filter((task) => {
    if (actor.isAdmin && owner !== 'all' && task.employee_id !== (owner === 'mine' ? actor.id : owner)) return false
    if (priority !== 'all' && task.priority !== priority) return false
    return matchesSearch([task.title, task.description, related(task, 'contacts')?.display_name, related(task, 'deals')?.deal_number], query)
  }), [actor.id, actor.isAdmin, owner, priority, query, tasks.rows])

  const buckets = useMemo(() => {
    const grouped = new Map<TaskBucket, JsonRecord[]>(taskBuckets.map((bucket) => [bucket.value, []]))
    for (const task of visible) grouped.get(taskBucket(task, now))?.push(task)
    // Within a bucket: most urgent first, then soonest. Closed work reads newest first.
    for (const [key, rows] of grouped) {
      if (key === 'done') rows.sort((a, b) => String(b.updated_at ?? b.due_at).localeCompare(String(a.updated_at ?? a.due_at)))
      else rows.sort((a, b) => priorityRank(a) - priorityRank(b) || String(a.due_at).localeCompare(String(b.due_at)))
    }
    return grouped
  }, [now, visible])

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value == null) next.delete(key); else next.set(key, value)
    setParams(next, { replace: true })
  }

  if (page.loading) return <PortalLoading label="Loading follow-ups" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />

  const openCount = visible.filter((task) => task.status === 'open').length
  const overdue = buckets.get('overdue')?.length ?? 0
  const closed = buckets.get('done') ?? []

  return (
    <section className="crm-page" aria-labelledby="tasks-heading">
      <div className="crm-header">
        <div><span className="crm-eyebrow">CRM / FOLLOW-UP QUEUE</span><h2 id="tasks-heading">Follow-up queue</h2><p>{openCount ? `${openCount} open${overdue ? ` · ${overdue} overdue` : ''}. Work top to bottom: overdue first, then today.` : 'Nothing open. Book the next step from any lead, customer, or deal.'}</p></div>
        <div className="crm-header-actions"><button className="crm-btn primary" type="button" onClick={() => setParam('new', '1')}><Plus size={15} />New follow-up</button></div>
      </div>
      <div className="crm-toolbar">
        <label className="crm-search"><Search size={15} /><span className="sr-only">Search follow-ups</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search follow-ups" /></label>
        <SelectFilter label="Priority" value={priority} onChange={setPriority}><option value="all">Any</option>{taskPriorities.map((item) => <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}</SelectFilter>
        {actor.isAdmin ? (
          <SelectFilter label="Assigned employee" value={owner} disabled={employees.loading} onChange={(value) => setParam('owner', value === 'mine' ? null : value)}>
            <option value="mine">Me</option><option value="all">Everyone</option>
            {employees.rows.filter((person) => person.id !== actor.id).map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.display_name)}{person.active ? '' : ' (inactive)'}</option>)}
          </SelectFilter>
        ) : null}
        <button className="crm-chip crm-right" type="button" aria-pressed={showClosed} onClick={() => setShowClosed((value) => !value)}>Show closed <b>{closed.length}</b></button>
      </div>

      {!openCount && !(showClosed && closed.length) ? <div className="crm-card"><Empty title={tasks.rows.length ? 'No follow-ups match these filters' : 'Your queue is clear'}>{tasks.rows.length ? 'Change the owner or priority filter to see more.' : 'Schedule the next step from a lead, customer, or deal — or add one here.'}</Empty></div> : null}
      {taskBuckets.filter((bucket) => bucket.value !== 'done' || showClosed).map((bucket) => {
        const rows = buckets.get(bucket.value) ?? []
        if (!rows.length) return null
        return (
          <article key={bucket.value} className={`crm-card crm-bucket ${bucket.value}`}>
            <h3>{bucket.label} <span>{rows.length}</span></h3>
            <ul className="crm-tasks">{rows.map((task) => <TaskItem key={String(task.id)} task={task} now={now} employees={employees.rows} showRecord showOwner={actor.isAdmin && owner !== 'mine'} />)}</ul>
          </article>
        )
      })}
      {tasks.rows.length === 1000 ? <p className="crm-count">Showing the 1,000 earliest-due follow-ups.</p> : null}
      {creating ? <TaskDialog employees={employees.rows} contacts={contacts.rows} onClose={() => setParam('new', null)} /> : null}
    </section>
  )
}
