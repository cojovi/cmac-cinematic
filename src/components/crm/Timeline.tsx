import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightLeft, CalendarClock, CircleDollarSign, FileSignature, GitBranch, Inbox, Mail, MessageSquare,
  PackageCheck, Phone, ReceiptText, Send, StickyNote, Users, type LucideIcon,
} from 'lucide-react'
import type { JsonRecord } from '../../lib/database.types'
import { matchesTimelineFilter, timelineFilters, timelineKind, type TimelineFilter, type TimelineKind } from '../../lib/crm/activity'
import { relativeTime } from '../../lib/crm/pipeline'
import { activityActorName, activityPath, formatRecordDate, related } from '../../lib/team-management'
import { Empty } from './primitives'

const icons: Record<TimelineKind, LucideIcon> = {
  note: StickyNote, call: Phone, email: Mail, text: MessageSquare, meeting: Users, stage: GitBranch, task: CalendarClock,
  owner: ArrowRightLeft, intake: Inbox, sale: PackageCheck, quote: ReceiptText, deal: CircleDollarSign, marketing: Send, contract: FileSignature,
}

const touchKinds: TimelineKind[] = ['call', 'email', 'text', 'meeting', 'marketing']

export function Timeline({ rows, now, showContext = false, filterable = true }: { rows: JsonRecord[]; now: number; showContext?: boolean; filterable?: boolean }) {
  const [filter, setFilter] = useState<TimelineFilter>('all')
  const visible = useMemo(() => rows.filter((row) => matchesTimelineFilter(row, filter)), [filter, rows])

  if (!rows.length) return <Empty title="Nothing recorded yet">Calls, notes, follow-ups, and record changes will build the history here.</Empty>
  return (
    <>
      {filterable ? (
        <div className="crm-chips" role="group" aria-label="Filter timeline" style={{ marginBottom: 16 }}>
          {timelineFilters.map((item) => <button key={item.value} className="crm-chip" type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
        </div>
      ) : null}
      {!visible.length ? <Empty title="No entries of this type" /> : (
        <ol className="crm-timeline">
          {visible.map((row) => {
            const kind = timelineKind(row)
            const Icon = icons[kind]
            const path = showContext ? activityPath(row) : null
            const context = String(related(row, 'contacts')?.display_name ?? related(row, 'deals')?.deal_number ?? 'Open record')
            return (
              <li key={String(row.id)}>
                <span className={`crm-timeline-icon${touchKinds.includes(kind) ? ' touch' : kind === 'sale' ? ' good' : ''}`} aria-hidden="true"><Icon size={14} /></span>
                <div>
                  <div className="crm-timeline-head">
                    <strong>{String(row.title)}</strong>
                    <time dateTime={String(row.created_at)} title={formatRecordDate(row.created_at)}>{relativeTime(row.created_at, now)}</time>
                  </div>
                  {row.description ? <p>{String(row.description)}</p> : null}
                  <small>{activityActorName(row)}{path ? <> · <Link to={path}>{context}</Link></> : null}</small>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
