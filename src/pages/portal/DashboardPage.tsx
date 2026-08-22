import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Activity, CalendarDays, FileSignature, PackageCheck, Plus, ReceiptText, TrendingUp, UsersRound } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { usePortalRows } from '../../hooks/usePortalRows'
import { PortalError, PortalLoading } from '../../components/portal/AsyncState'
import InventoryHeadline from '../../components/portal/InventoryHeadline'

const dateTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function DashboardPage() {
  const [currentTime] = useState(() => Date.now())
  const { employee, previewMode } = useAuth()
  const leads = usePortalRows('leads', { select: 'id,status,created_at', orderBy: 'created_at', limit: 50 })
  const tasks = usePortalRows('tasks', { select: 'id,title,due_at,status,priority', orderBy: 'due_at', ascending: true, limit: 8 })
  const quotes = usePortalRows('quotes', { select: 'id,status,total', limit: 50 })
  const contracts = usePortalRows('contracts', { select: 'id,status', limit: 50 })
  const activities = usePortalRows('activities', { select: 'id,title,description,created_at,activity_type', orderBy: 'created_at', limit: 6 })
  const unitSales = usePortalRows('unit_sales', { select: 'id,sold_at', limit: 100 })
  const loading = leads.loading || tasks.loading || quotes.loading || contracts.loading || activities.loading || unitSales.loading
  const firstError = leads.error || tasks.error || quotes.error || contracts.error || activities.error || unitSales.error
  const openTasks = tasks.rows.filter((row) => row.status === 'open')
  const dueNow = openTasks.filter((row) => new Date(String(row.due_at)).getTime() <= currentTime)

  if (loading) return <PortalLoading label="Building your sales command center" />
  if (firstError) return <PortalError message={firstError} retry={() => void leads.reload()} />

  const metrics = [
    { label: 'Assigned leads', value: leads.rows.filter((row) => !['converted', 'lost', 'archived'].includes(String(row.status))).length, note: `${leads.rows.filter((row) => row.status === 'new').length} waiting for first touch`, Icon: TrendingUp },
    { label: 'Follow-ups due', value: dueNow.length, note: `${openTasks.length} total open`, Icon: CalendarDays },
    { label: 'Open quotes', value: quotes.rows.filter((row) => !['accepted', 'declined', 'expired', 'cancelled'].includes(String(row.status))).length, note: 'Portal records · manual status', Icon: ReceiptText },
    { label: 'Contract records', value: contracts.rows.length, note: 'DocuSign integration coming soon', Icon: FileSignature },
  ]

  return (
    <section className="portal-library-view" aria-labelledby="dashboard-heading">
      <div className="workspace-view-heading">
        <div><span>{previewMode ? 'LOCAL PREVIEW / FIXTURE DATA' : 'LIVE / ASSIGNED RECORDS'}</span><h2 id="dashboard-heading">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {employee?.first_name}.</h2><p>What needs attention, what is moving, and what inventory is ready right now.</p></div>
        <Link className="portal-primary-button" to="/employee-portal/sales/new"><Plus size={16} /> Start new sale</Link>
      </div>
      <div className="dashboard-inventory-strip"><InventoryHeadline compact /></div>
      <div className="portal-metric-grid">
        {metrics.map(({ label, value, note, Icon }) => <article key={label} className="portal-metric-card"><div><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small>{note}</small></article>)}
      </div>
      <div className="overview-layout production-overview">
        <article className="workspace-card task-card">
          <div className="workspace-card-heading"><div><span>NEXT / FOLLOW-UPS</span><h3>Priority queue</h3></div><CalendarDays size={21} /></div>
          {openTasks.slice(0, 4).map((task) => <Link key={String(task.id)} to="/employee-portal/tasks"><span><b>{String(task.title)}</b><small>{dateTime.format(new Date(String(task.due_at)))} · {String(task.priority)}</small></span><span className={new Date(String(task.due_at)).getTime() < currentTime ? 'status-pill danger' : 'status-pill'}>{new Date(String(task.due_at)).getTime() < currentTime ? 'Overdue' : 'Upcoming'}</span></Link>)}
        </article>
        <article className="workspace-card activity-card">
          <div className="workspace-card-heading"><div><span>ACTIVITY / RECENT</span><h3>Latest movement</h3></div><Activity size={21} /></div>
          {activities.rows.map((item) => <div key={String(item.id)}><Activity size={16} /><span><b>{String(item.title)}</b><small>{dateTime.format(new Date(String(item.created_at)))}</small></span></div>)}
        </article>
        <article className="workspace-card quick-links-card">
          <div className="workspace-card-heading"><div><span>WORKSPACE / SHORTCUTS</span><h3>Move the work forward</h3></div><PackageCheck size={21} /></div>
          <Link to="/employee-portal/leads"><UsersRound size={16} /><span>Review assigned leads</span></Link>
          <Link to="/employee-portal/inventory"><PackageCheck size={16} /><span>Check available inventory</span></Link>
          <Link to="/employee-portal/contracts"><FileSignature size={16} /><span>View contract roadmap</span></Link>
        </article>
      </div>
    </section>
  )
}
