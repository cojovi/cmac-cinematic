import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Activity, CalendarDays, FileSignature, PackageCheck, Plus, ReceiptText, TrendingUp, UsersRound } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { usePortalRows } from '../../hooks/usePortalRows'
import { PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import InventoryHeadline from '../../components/portal/InventoryHeadline'
import { usePortalSummary } from '../../hooks/usePortalSummary'
import { activitySelect } from '../../lib/team-management'
import ActivityFeed from '../../components/portal/ActivityFeed'

const dateTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function DashboardPage() {
  const [currentTime] = useState(() => Date.now())
  const { employee, previewMode } = useAuth()
  const summary = usePortalSummary('portal_dashboard_summary')
  const tasks = usePortalRows('tasks', { select: 'id,title,due_at,status,priority', filter: { column: 'status', value: 'open' }, orderBy: 'due_at', ascending: true, limit: 4 })
  const activities = usePortalRows('activities', { select: activitySelect, orderBy: 'created_at', limit: 6 })
  const loading = summary.loading || tasks.loading || activities.loading
  const firstError = summary.error || tasks.error || activities.error
  const openTasks = tasks.rows.filter((row) => row.status === 'open')

  if (loading) return <PortalLoading label="Building your sales command center" />
  if (firstError) return <PortalError message={firstError} retry={() => void Promise.all([summary.reload(), tasks.reload(), activities.reload()])} />
  if (!summary.data) return <PortalEmpty title="Summary unavailable" copy="Refresh the page to request the latest totals." />
  const totals = summary.data

  const metrics = [
    { label: employee?.role === 'admin' ? 'Company open leads' : 'Assigned leads', value: totals.leads, note: `${totals.new_leads} waiting for first touch`, Icon: TrendingUp },
    { label: 'Follow-ups due', value: totals.due_tasks, note: `${totals.tasks} total open`, Icon: CalendarDays },
    { label: 'Open quotes', value: totals.quotes, note: 'Portal records · manual status', Icon: ReceiptText },
    { label: 'Units sold', value: totals.units_sold, note: `${totals.contracts} contract records · Signing coming soon`, Icon: PackageCheck },
  ]

  return (
    <section className="portal-library-view" aria-labelledby="dashboard-heading">
      <div className="workspace-view-heading">
        <div><span>{previewMode ? 'LOCAL PREVIEW / FIXTURE DATA' : employee?.role === 'admin' ? 'LIVE / COMPANY-WIDE RECORDS' : 'LIVE / ASSIGNED RECORDS'}</span><h2 id="dashboard-heading">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {employee?.first_name}.</h2><p>{employee?.role === 'admin' ? 'Company-wide totals and team activity. Open Employees to review a specific sales representative.' : 'Your assigned work, recent activity, and available inventory.'}</p></div>
        <Link className="portal-primary-button" to="/employee-portal/sales/new"><Plus size={16} /> Start new sale</Link>
      </div>
      <div className="dashboard-inventory-strip"><InventoryHeadline compact /></div>
      <div className="portal-metric-grid">
        {metrics.map(({ label, value, note, Icon }) => <article key={label} className="portal-metric-card"><div><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small>{note}</small></article>)}
      </div>
      <div className="overview-layout production-overview">
        <article className="workspace-card task-card">
          <div className="workspace-card-heading"><div><span>NEXT / FOLLOW-UPS</span><h3>Priority queue</h3></div><CalendarDays size={21} /></div>
          {!openTasks.length ? <PortalEmpty title="No open follow-ups" copy="Schedule the next step from a customer, lead, or deal." /> : null}
          {openTasks.slice(0, 4).map((task) => <Link key={String(task.id)} to="/employee-portal/tasks"><span><b>{String(task.title)}</b><small>{dateTime.format(new Date(String(task.due_at)))} · {String(task.priority)}</small></span><span className={new Date(String(task.due_at)).getTime() < currentTime ? 'status-pill danger' : 'status-pill'}>{new Date(String(task.due_at)).getTime() < currentTime ? 'Overdue' : 'Upcoming'}</span></Link>)}
        </article>
        <article className="workspace-card activity-card">
          <div className="workspace-card-heading"><div><span>ACTIVITY / RECENT</span><h3>Latest movement</h3></div><Activity size={21} /></div>
          <ActivityFeed rows={activities.rows} />
        </article>
        <article className="workspace-card quick-links-card">
          <div className="workspace-card-heading"><div><span>WORKSPACE / SHORTCUTS</span><h3>Move the work forward</h3></div><PackageCheck size={21} /></div>
          <Link to="/employee-portal/leads"><UsersRound size={16} /><span>Review assigned leads</span></Link>
          {employee?.role === 'admin' ? <Link to="/employee-portal/admin/employees"><UsersRound size={16} /><span>Manage team & ownership</span></Link> : null}
          <Link to="/employee-portal/inventory"><PackageCheck size={16} /><span>Check available inventory</span></Link>
          <Link to="/employee-portal/contracts"><FileSignature size={16} /><span>View contract roadmap</span></Link>
        </article>
      </div>
    </section>
  )
}
