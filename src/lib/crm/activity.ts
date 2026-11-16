import type { JsonRecord } from '../database.types'

/**
 * Logged touches are stored as `note_added` activities with the kind and
 * outcome in `metadata`. That keeps them inside the existing activity-type
 * constraint and insert policy while still letting the timeline and reports
 * tell a call from an email.
 */
export type TouchKind = 'note' | 'call' | 'email' | 'text' | 'meeting'

export interface TouchDef { value: TouchKind; label: string; verb: string; outcomes: string[]; placeholder: string }

export const touchKinds: TouchDef[] = [
  { value: 'note', label: 'Note', verb: 'Note added', outcomes: [], placeholder: 'Site context, budget, objections, what they asked for…' },
  { value: 'call', label: 'Call', verb: 'Call logged', outcomes: ['Connected', 'Left voicemail', 'No answer', 'Wrong number'], placeholder: 'What was discussed and what happens next?' },
  { value: 'email', label: 'Email', verb: 'Email logged', outcomes: ['Sent', 'Reply received', 'Bounced'], placeholder: 'What did you send or receive?' },
  { value: 'text', label: 'Text', verb: 'Text logged', outcomes: ['Sent', 'Reply received'], placeholder: 'What did you send or receive?' },
  { value: 'meeting', label: 'Meeting', verb: 'Meeting logged', outcomes: ['Site visit', 'Showroom / lot visit', 'Video call', 'No-show'], placeholder: 'Who attended, what was decided, and the next step.' },
]

export function touchDef(kind: unknown) {
  return touchKinds.find((item) => item.value === kind) ?? touchKinds[0]
}

export function touchTitle(kind: TouchKind, outcome: string) {
  const def = touchDef(kind)
  return outcome ? `${def.verb} · ${outcome}` : def.verb
}

export type TimelineKind = TouchKind | 'stage' | 'task' | 'owner' | 'intake' | 'sale' | 'quote' | 'deal' | 'marketing' | 'contract'

/** Classify any stored activity so the timeline can pick an icon and filter group. */
export function timelineKind(activity: JsonRecord): TimelineKind {
  const type = String(activity.activity_type ?? '')
  const metadata = activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata) ? activity.metadata as JsonRecord : {}
  if (type === 'note_added') {
    const kind = String(metadata.kind ?? 'note')
    return (['call', 'email', 'text', 'meeting'] as const).find((item) => item === kind) ?? 'note'
  }
  if (type === 'follow_up_created') return 'task'
  if (type === 'status_changed') {
    const title = String(activity.title ?? '')
    if (/^Follow-up /.test(title)) return 'task'
    if (/^Quote /.test(title)) return 'quote'
    if (/^Deal /.test(title)) return 'deal'
    return 'stage'
  }
  if (type === 'lead_assigned') return 'owner'
  if (type === 'lead_created') return 'intake'
  if (type === 'unit_sold') return 'sale'
  if (type === 'marketing_sent') return 'marketing'
  if (type.startsWith('quote_')) return 'quote'
  if (type.startsWith('contract_')) return 'contract'
  if (type === 'deal_created') return 'deal'
  return 'note'
}

export type TimelineFilter = 'all' | 'conversations' | 'notes' | 'changes'

export const timelineFilters: { value: TimelineFilter; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'conversations', label: 'Calls & messages' },
  { value: 'notes', label: 'Notes' },
  { value: 'changes', label: 'Record changes' },
]

export function matchesTimelineFilter(activity: JsonRecord, filter: TimelineFilter) {
  if (filter === 'all') return true
  const kind = timelineKind(activity)
  if (filter === 'conversations') return ['call', 'email', 'text', 'meeting', 'marketing'].includes(kind)
  if (filter === 'notes') return kind === 'note'
  return !['call', 'email', 'text', 'meeting', 'marketing', 'note'].includes(kind)
}
