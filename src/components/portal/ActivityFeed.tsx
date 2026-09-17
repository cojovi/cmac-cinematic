import { Link } from 'react-router-dom'
import { activityActorName, activityPath, formatRecordDate, related } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'
import { PortalEmpty } from './AsyncState'

export default function ActivityFeed({ rows }: { rows: JsonRecord[] }) {
  if (!rows.length) return <PortalEmpty title="No recorded activity" copy="Notes, follow-ups, ownership changes, and transaction updates will appear here. This is a work history, not online-status tracking." />
  return <ol className="team-activity-feed">{rows.map(row => {
    const path = activityPath(row)
    const context = String(related(row, 'contacts')?.display_name ?? related(row, 'deals')?.deal_number ?? 'Open record')
    return <li key={String(row.id)}><span className="activity-node" /><div>
      <div className="activity-byline"><strong>{activityActorName(row)}</strong><time dateTime={String(row.created_at)}>{formatRecordDate(row.created_at)}</time></div>
      <h4>{String(row.title)}</h4>{row.description ? <p>{String(row.description)}</p> : null}
      {path ? <Link to={path}>{context} <span aria-hidden="true">↗</span></Link> : null}
    </div></li>
  })}</ol>
}
