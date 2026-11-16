import type { JsonRecord } from '../database.types'

// ---------------------------------------------------------------------------
// Lead pipeline
// ---------------------------------------------------------------------------

export type LeadStatus = 'new' | 'contacted' | 'nurturing' | 'qualified' | 'converted' | 'lost' | 'archived'
export type Tone = 'neutral' | 'info' | 'progress' | 'good' | 'bad' | 'muted' | 'warn'

export interface StageDef<Value extends string> {
  value: Value
  label: string
  hint: string
  tone: Tone
}

export const leadStages: StageDef<LeadStatus>[] = [
  { value: 'new', label: 'New', hint: 'Waiting for first contact', tone: 'info' },
  { value: 'contacted', label: 'Contacted', hint: 'First conversation made', tone: 'neutral' },
  { value: 'nurturing', label: 'Nurturing', hint: 'Interested, not ready yet', tone: 'progress' },
  { value: 'qualified', label: 'Qualified', hint: 'Ready for a deal', tone: 'good' },
  { value: 'converted', label: 'Converted', hint: 'Moved into a deal', tone: 'good' },
  { value: 'lost', label: 'Lost', hint: 'Closed without a deal', tone: 'bad' },
  { value: 'archived', label: 'Archived', hint: 'Removed from the working pipeline', tone: 'muted' },
]

export const openLeadStatuses: LeadStatus[] = ['new', 'contacted', 'nurturing', 'qualified']
export const closedLeadStatuses: LeadStatus[] = ['converted', 'lost', 'archived']

export function leadStage(value: unknown): StageDef<LeadStatus> {
  return leadStages.find((stage) => stage.value === value) ?? { value: 'new', label: humanize(value) || 'Unknown', hint: '', tone: 'muted' }
}

export function isOpenLead(lead: JsonRecord) {
  return openLeadStatuses.includes(String(lead.status) as LeadStatus)
}

/**
 * Who may move a lead between working stages.
 * Administrators can move anything; a representative can move a lead they own.
 * Archiving and reopening a closed lead stay administrator-only. The database
 * enforces the same rule — this only decides which controls to show.
 */
export function leadMoveTargets(role: string | undefined, employeeId: string | undefined, lead: JsonRecord): LeadStatus[] {
  const status = String(lead.status) as LeadStatus
  if (status === 'converted') return []
  const isAdmin = role === 'admin'
  const isOwner = Boolean(employeeId) && lead.assigned_employee_id === employeeId
  if (!isAdmin && !isOwner) return []
  if (!isAdmin && !openLeadStatuses.includes(status)) return []
  const targets: LeadStatus[] = [...openLeadStatuses, 'lost']
  if (isAdmin) targets.push('archived')
  return targets.filter((target) => target !== status)
}

export function canConvertLead(role: string | undefined, employeeId: string | undefined, lead: JsonRecord) {
  const status = String(lead.status) as LeadStatus
  if (!openLeadStatuses.includes(status)) return false
  return role === 'admin' || (Boolean(employeeId) && lead.assigned_employee_id === employeeId)
}

/**
 * Deleting is open to every signed-in employee for records they own (an
 * administrator: any record). A lead that became a deal is part of that sale's
 * history and cannot be deleted by anyone. The server enforces the same rules,
 * and additionally refuses customers that have deals, quotes, contracts, or
 * sent marketing on record.
 */
export function canDeleteLead(role: string | undefined, employeeId: string | undefined, lead: JsonRecord) {
  if (lead.status === 'converted') return false
  return role === 'admin' || (Boolean(employeeId) && lead.assigned_employee_id === employeeId)
}

export function canDeleteContact(role: string | undefined, employeeId: string | undefined, contact: JsonRecord) {
  return role === 'admin' || (Boolean(employeeId) && contact.assigned_employee_id === employeeId)
}

// ---------------------------------------------------------------------------
// Lead heat — a transparent prioritisation hint, never stored
// ---------------------------------------------------------------------------

export type HeatLevel = 'hot' | 'warm' | 'cool'
export interface LeadHeat { score: number; level: HeatLevel; reasons: string[] }

const timingPoints: [RegExp, number, string][] = [
  [/as soon as possible|immediately/i, 40, 'Wants to move now'],
  [/1\s*[–-]\s*3 months|30 days or less/i, 30, 'Buying within 3 months'],
  [/3\s*[–-]\s*6 months|30-90 days/i, 18, 'Buying within 6 months'],
  [/6\+ months/i, 8, 'Longer timeline'],
  [/exploring|curious/i, 4, 'Just exploring'],
]

const statusPoints: Partial<Record<LeadStatus, number>> = { qualified: 30, nurturing: 14, contacted: 12, new: 10 }

export function leadHeat(lead: JsonRecord, now: number): LeadHeat {
  const reasons: string[] = []
  let score = 0
  const timing = String(lead.desired_timing ?? '')
  const timingMatch = timingPoints.find(([pattern]) => pattern.test(timing))
  if (timingMatch) { score += timingMatch[1]; reasons.push(timingMatch[2]) }
  const status = String(lead.status) as LeadStatus
  score += statusPoints[status] ?? 0
  if (status === 'qualified') reasons.push('Qualified')
  const ageDays = daysSince(lead.created_at, now)
  if (ageDays !== null) {
    if (ageDays <= 2) { score += 18; reasons.push('Fresh inquiry') }
    else if (ageDays <= 7) score += 10
    else if (ageDays <= 30) score += 4
  }
  if (/workforce|commercial|10\+|5-9/i.test(`${String(lead.project_type ?? '')} ${String(lead.summary ?? '')}`)) { score += 8; reasons.push('Multi-unit potential') }
  const level: HeatLevel = score >= 60 ? 'hot' : score >= 36 ? 'warm' : 'cool'
  return { score: Math.min(100, score), level, reasons }
}

// ---------------------------------------------------------------------------
// Deal pipeline
// ---------------------------------------------------------------------------

export type DealStage = 'draft' | 'quote' | 'negotiation' | 'contract' | 'signed' | 'closed_won' | 'closed_lost'

export const dealStages: (StageDef<DealStage> & { probability: number })[] = [
  { value: 'draft', label: 'Draft', hint: 'Scoping the sale', tone: 'neutral', probability: 0.1 },
  { value: 'quote', label: 'Quote', hint: 'Pricing with the customer', tone: 'info', probability: 0.3 },
  { value: 'negotiation', label: 'Negotiation', hint: 'Terms being worked', tone: 'progress', probability: 0.5 },
  { value: 'contract', label: 'Contract', hint: 'Paperwork out', tone: 'progress', probability: 0.75 },
  { value: 'signed', label: 'Signed', hint: 'Signed, awaiting completion', tone: 'good', probability: 0.9 },
  { value: 'closed_won', label: 'Won', hint: 'Sold and attributed', tone: 'good', probability: 1 },
  { value: 'closed_lost', label: 'Lost', hint: 'Closed without a sale', tone: 'bad', probability: 0 },
]

/** Stages a person can move a deal to by hand. Won is only ever set by the audited sale-completion workflow. */
export const workingDealStages: DealStage[] = ['draft', 'quote', 'negotiation', 'contract', 'signed']

export function dealStage(value: unknown) {
  return dealStages.find((stage) => stage.value === value) ?? { value: 'draft' as DealStage, label: humanize(value) || 'Unknown', hint: '', tone: 'muted' as Tone, probability: 0 }
}

export function isOpenDeal(deal: JsonRecord) {
  return deal.status === 'open' || deal.status === 'on_hold'
}

export function dealValue(deal: JsonRecord) {
  return toNumber(deal.base_amount) + toNumber(deal.delivery_amount)
}

export function weightedDealValue(deal: JsonRecord) {
  return isOpenDeal(deal) ? dealValue(deal) * dealStage(deal.stage).probability : 0
}

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------

export type TaskBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'done'

export const taskBuckets: { value: TaskBucket; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'later', label: 'Later' },
  { value: 'done', label: 'Closed' },
]

export const taskPriorities = ['urgent', 'high', 'normal', 'low'] as const
export type TaskPriority = typeof taskPriorities[number]

function startOfDay(time: number) {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const DAY = 86_400_000

export function taskBucket(task: JsonRecord, now: number): TaskBucket {
  if (task.status !== 'open') return 'done'
  const due = new Date(String(task.due_at)).getTime()
  if (Number.isNaN(due)) return 'later'
  if (due < now) return 'overdue'
  const today = startOfDay(now)
  if (due < today + DAY) return 'today'
  if (due < today + 2 * DAY) return 'tomorrow'
  if (due < today + 8 * DAY) return 'week'
  return 'later'
}

export type DuePreset = 'in_2h' | 'tomorrow' | 'in_3d' | 'next_week'

export const duePresets: { value: DuePreset; label: string }[] = [
  { value: 'in_2h', label: 'In 2 hours' },
  { value: 'tomorrow', label: 'Tomorrow 9 AM' },
  { value: 'in_3d', label: 'In 3 days' },
  { value: 'next_week', label: 'Next Monday' },
]

/** Resolve a preset to a concrete local time. Day-based presets land at 9 AM so they sort to the start of a workday. */
export function presetDue(preset: DuePreset, now: number): Date {
  if (preset === 'in_2h') return new Date(now + 2 * 3_600_000)
  const date = new Date(startOfDay(now))
  if (preset === 'tomorrow') date.setDate(date.getDate() + 1)
  else if (preset === 'in_3d') date.setDate(date.getDate() + 3)
  else date.setDate(date.getDate() + (((8 - date.getDay()) % 7) || 7))
  date.setHours(9, 0, 0, 0)
  return date
}

/** Value for <input type="datetime-local"> in the browser's own timezone. */
export function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ---------------------------------------------------------------------------
// Signals — what has (not) happened on each lead
// ---------------------------------------------------------------------------

export interface RecordSignals {
  lastTouchAt: string | null
  touches: number
  nextTaskDue: string | null
  openTasks: number
  overdueTasks: number
}

const emptySignals: RecordSignals = { lastTouchAt: null, touches: 0, nextTaskDue: null, openTasks: 0, overdueTasks: 0 }

/** Intake and ownership bookkeeping are not customer touches. */
export function isTouch(activity: JsonRecord) {
  return !['lead_created', 'lead_assigned', 'follow_up_created'].includes(String(activity.activity_type))
    && !(activity.activity_type === 'status_changed' && /^Follow-up /.test(String(activity.title ?? '')))
}

export function buildSignals(key: 'lead_id' | 'contact_id' | 'deal_id', activities: JsonRecord[], tasks: JsonRecord[], now: number) {
  const map = new Map<string, RecordSignals>()
  const entry = (id: string) => {
    let value = map.get(id)
    if (!value) { value = { ...emptySignals }; map.set(id, value) }
    return value
  }
  for (const activity of activities) {
    const id = activity[key]
    if (!id || !isTouch(activity)) continue
    const signals = entry(String(id))
    signals.touches += 1
    const created = String(activity.created_at ?? '')
    if (created && (!signals.lastTouchAt || created > signals.lastTouchAt)) signals.lastTouchAt = created
  }
  for (const task of tasks) {
    const id = task[key]
    if (!id || task.status !== 'open') continue
    const signals = entry(String(id))
    signals.openTasks += 1
    const due = String(task.due_at ?? '')
    if (due && new Date(due).getTime() < now) signals.overdueTasks += 1
    if (due && (!signals.nextTaskDue || due < signals.nextTaskDue)) signals.nextTaskDue = due
  }
  return { get: (id: unknown): RecordSignals => map.get(String(id)) ?? emptySignals }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export function countBy<Row>(rows: Row[], pick: (row: Row) => string) {
  const counts = new Map<string, number>()
  for (const row of rows) { const key = pick(row); counts.set(key, (counts.get(key) ?? 0) + 1) }
  return counts
}

export interface FunnelStep { value: LeadStatus; label: string; reached: number; current: number }

/**
 * How far leads have progressed. "Reached" counts every lead at or beyond a
 * stage; lost and archived leads only count for the first stage because the
 * schema does not record which stage they were lost from.
 */
export function leadFunnel(leads: JsonRecord[]): FunnelStep[] {
  const order: LeadStatus[] = ['new', 'contacted', 'nurturing', 'qualified', 'converted']
  const counts = countBy(leads, (lead) => String(lead.status))
  return order.map((value, index) => ({
    value,
    label: leadStage(value).label,
    current: counts.get(value) ?? 0,
    reached: index === 0 ? leads.length : order.slice(index).reduce((sum, stage) => sum + (counts.get(stage) ?? 0), 0),
  }))
}

export interface SourceRow { source: string; total: number; open: number; converted: number; lost: number; conversion: number | null }

export function sourceBreakdown(leads: JsonRecord[]): SourceRow[] {
  const rows = new Map<string, SourceRow>()
  for (const lead of leads) {
    const source = String(lead.source ?? 'other')
    const row = rows.get(source) ?? { source, total: 0, open: 0, converted: 0, lost: 0, conversion: null }
    row.total += 1
    if (lead.status === 'converted') row.converted += 1
    else if (lead.status === 'lost') row.lost += 1
    else if (isOpenLead(lead)) row.open += 1
    rows.set(source, row)
  }
  return [...rows.values()]
    .map((row) => ({ ...row, conversion: row.converted + row.lost > 0 ? row.converted / (row.converted + row.lost) : null }))
    .sort((a, b) => b.total - a.total)
}

export interface WeekBucket { start: number; label: string; count: number }

export function weeklyCounts(rows: JsonRecord[], dateKey: string, weeks: number, now: number): WeekBucket[] {
  const thisWeek = new Date(startOfDay(now))
  thisWeek.setDate(thisWeek.getDate() - ((thisWeek.getDay() + 6) % 7)) // Monday
  const format = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  const buckets: WeekBucket[] = []
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = new Date(thisWeek)
    start.setDate(start.getDate() - index * 7)
    buckets.push({ start: start.getTime(), label: format.format(start), count: 0 })
  }
  for (const row of rows) {
    const time = new Date(String(row[dateKey])).getTime()
    if (Number.isNaN(time)) continue
    for (let index = buckets.length - 1; index >= 0; index -= 1) {
      if (time >= buckets[index].start) { if (time < buckets[index].start + 7 * DAY) buckets[index].count += 1; break }
    }
  }
  return buckets
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function toNumber(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

export function humanize(value: unknown) {
  if (value == null || value === '') return ''
  const text = String(value).replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const formatMoney = (value: unknown) => wholeDollars.format(toNumber(value))
export const formatMoneyExact = (value: unknown) => cents.format(toNumber(value))

export function daysSince(value: unknown, now: number) {
  if (!value) return null
  const time = new Date(String(value)).getTime()
  return Number.isNaN(time) ? null : Math.max(0, Math.floor((now - time) / DAY))
}

/** "3d ago", "in 2h", "just now" — compact because it sits inside dense cards and tables. */
export function relativeTime(value: unknown, now: number) {
  if (!value) return '—'
  const time = new Date(String(value)).getTime()
  if (Number.isNaN(time)) return '—'
  const diff = time - now
  const abs = Math.abs(diff)
  const unit = abs < 3_600_000 ? [Math.round(abs / 60_000), 'm'] as const
    : abs < DAY ? [Math.round(abs / 3_600_000), 'h'] as const
    : abs < 60 * DAY ? [Math.round(abs / DAY), 'd'] as const
    : [Math.round(abs / (30 * DAY)), 'mo'] as const
  if (unit[0] === 0) return 'just now'
  return diff < 0 ? `${unit[0]}${unit[1]} ago` : `in ${unit[0]}${unit[1]}`
}

const dayTime = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const timeOnly = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function formatDate(value: unknown) {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '—' : shortDate.format(date)
}

export function dueLabel(value: unknown, now: number) {
  if (!value) return 'No due date'
  const date = new Date(String(value))
  const time = date.getTime()
  if (Number.isNaN(time)) return 'No due date'
  const today = startOfDay(now)
  if (time < now) return `Overdue · ${relativeTime(value, now).replace(' ago', '')} late`
  if (time < today + DAY) return `Today ${timeOnly.format(date)}`
  if (time < today + 2 * DAY) return `Tomorrow ${timeOnly.format(date)}`
  return dayTime.format(date)
}

export function initials(name: unknown) {
  return String(name ?? '').split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '—'
}

export function matchesSearch(parts: unknown[], query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = parts.filter((part) => part != null).join(' ').toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

export function telHref(phone: unknown) {
  const digits = String(phone ?? '').replace(/[^+\d]/g, '')
  return digits.length >= 7 ? `tel:${digits}` : null
}

export function smsHref(phone: unknown) {
  const digits = String(phone ?? '').replace(/[^+\d]/g, '')
  return digits.length >= 7 ? `sms:${digits}` : null
}
