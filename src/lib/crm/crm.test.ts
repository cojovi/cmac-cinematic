import { describe, expect, it } from 'vitest'
import { matchesTimelineFilter, timelineKind, touchTitle } from './activity'
import { toCsv } from './csv'
import {
  buildSignals, canConvertLead, dealValue, dueLabel, leadFunnel, leadHeat, leadMoveTargets, matchesSearch, presetDue, relativeTime,
  sourceBreakdown, taskBucket, weeklyCounts, weightedDealValue,
} from './pipeline'
import { qrToLeadPrefill } from './qr-handoff'

const DAY = 86_400_000
// A fixed local Wednesday noon keeps the day-boundary tests independent of when and where they run.
const now = new Date(2026, 10, 18, 12, 0, 0).getTime()
const iso = (offset: number) => new Date(now + offset).toISOString()

describe('lead permissions shown in the UI', () => {
  const mine = { status: 'contacted', assigned_employee_id: 'rep' }
  it('lets an owner work the open pipeline and close a lead, but not archive it', () => {
    expect(leadMoveTargets('sales_rep', 'rep', mine)).toEqual(['new', 'nurturing', 'qualified', 'lost'])
    expect(canConvertLead('sales_rep', 'rep', mine)).toBe(true)
  })
  it('gives a representative no controls on someone else’s or a closed lead', () => {
    expect(leadMoveTargets('sales_rep', 'other', mine)).toEqual([])
    expect(canConvertLead('sales_rep', 'other', mine)).toBe(false)
    expect(leadMoveTargets('sales_rep', 'rep', { ...mine, status: 'lost' })).toEqual([])
    expect(canConvertLead('sales_rep', 'rep', { ...mine, status: 'lost' })).toBe(false)
  })
  it('lets an administrator archive and reopen, and locks converted leads for everyone', () => {
    expect(leadMoveTargets('admin', 'admin', mine)).toContain('archived')
    expect(leadMoveTargets('admin', 'admin', { ...mine, status: 'lost' })).toContain('contacted')
    expect(leadMoveTargets('admin', 'admin', { ...mine, status: 'converted' })).toEqual([])
    expect(canConvertLead('admin', 'admin', { ...mine, status: 'converted' })).toBe(false)
  })
})

describe('lead heat', () => {
  it('ranks an urgent, fresh, qualified lead above an old explorer', () => {
    const hot = leadHeat({ status: 'qualified', desired_timing: 'As soon as possible', created_at: iso(-DAY) }, now)
    const cool = leadHeat({ status: 'new', desired_timing: 'Just exploring', created_at: iso(-40 * DAY) }, now)
    expect(hot.level).toBe('hot')
    expect(cool.level).toBe('cool')
    expect(hot.score).toBeGreaterThan(cool.score)
    expect(hot.reasons).toContain('Wants to move now')
  })
  it('does not crash on a lead with no timing or dates', () => {
    expect(leadHeat({ status: 'new' }, now).level).toBe('cool')
  })
})

describe('follow-up buckets and dates', () => {
  it('sorts open work by when it is due and keeps closed work separate', () => {
    expect(taskBucket({ status: 'open', due_at: iso(-60_000) }, now)).toBe('overdue')
    expect(taskBucket({ status: 'open', due_at: iso(3_600_000) }, now)).toBe('today')
    expect(taskBucket({ status: 'open', due_at: iso(DAY) }, now)).toBe('tomorrow')
    expect(taskBucket({ status: 'open', due_at: iso(4 * DAY) }, now)).toBe('week')
    expect(taskBucket({ status: 'open', due_at: iso(30 * DAY) }, now)).toBe('later')
    expect(taskBucket({ status: 'completed', due_at: iso(-DAY) }, now)).toBe('done')
    expect(taskBucket({ status: 'open', due_at: 'not-a-date' }, now)).toBe('later')
  })
  it('resolves presets to a workday morning', () => {
    const tomorrow = presetDue('tomorrow', now)
    expect([tomorrow.getDate(), tomorrow.getHours(), tomorrow.getMinutes()]).toEqual([19, 9, 0])
    const monday = presetDue('next_week', now)
    expect([monday.getDay(), monday.getDate(), monday.getHours()]).toEqual([1, 23, 9])
    // From a Monday, "next Monday" is a week out, never the same day.
    expect(presetDue('next_week', new Date(2026, 10, 23, 8).getTime()).getDate()).toBe(30)
    expect(presetDue('in_2h', now).getTime()).toBe(now + 2 * 3_600_000)
  })
  it('labels due dates relative to today', () => {
    expect(dueLabel(iso(-2 * DAY), now)).toBe('Overdue · 2d late')
    expect(dueLabel(iso(3_600_000), now)).toMatch(/^Today /)
    expect(dueLabel(iso(DAY), now)).toMatch(/^Tomorrow /)
    expect(dueLabel(null, now)).toBe('No due date')
    expect(relativeTime(iso(-3 * DAY), now)).toBe('3d ago')
    expect(relativeTime(iso(2 * 3_600_000), now)).toBe('in 2h')
    expect(relativeTime('nope', now)).toBe('—')
  })
})

describe('record signals', () => {
  it('counts real customer touches, not intake or follow-up bookkeeping', () => {
    const signals = buildSignals('lead_id', [
      { lead_id: 'a', activity_type: 'lead_created', created_at: iso(-5 * DAY) },
      { lead_id: 'a', activity_type: 'lead_assigned', created_at: iso(-4 * DAY) },
      { lead_id: 'a', activity_type: 'follow_up_created', created_at: iso(-3 * DAY) },
      { lead_id: 'a', activity_type: 'status_changed', title: 'Follow-up completed', created_at: iso(-2 * DAY) },
      { lead_id: 'b', activity_type: 'note_added', created_at: iso(-2 * DAY) },
      { lead_id: 'b', activity_type: 'note_added', created_at: iso(-DAY) },
    ], [
      { lead_id: 'b', status: 'open', due_at: iso(-DAY) },
      { lead_id: 'b', status: 'open', due_at: iso(DAY) },
      { lead_id: 'b', status: 'completed', due_at: iso(-3 * DAY) },
    ], now)
    expect(signals.get('a')).toMatchObject({ touches: 0, lastTouchAt: null, openTasks: 0 })
    expect(signals.get('b')).toMatchObject({ touches: 2, lastTouchAt: iso(-DAY), openTasks: 2, overdueTasks: 1, nextTaskDue: iso(-DAY) })
    expect(signals.get('missing').touches).toBe(0)
  })
})

describe('reporting math', () => {
  const leads = [
    { status: 'new', source: 'website' }, { status: 'contacted', source: 'website' }, { status: 'qualified', source: 'referral' },
    { status: 'converted', source: 'referral' }, { status: 'lost', source: 'website' }, { status: 'archived', source: 'phone' },
  ]
  it('builds a funnel where each stage counts leads at or beyond it', () => {
    expect(leadFunnel(leads).map((step) => [step.value, step.reached])).toEqual([['new', 6], ['contacted', 3], ['nurturing', 2], ['qualified', 2], ['converted', 1]])
  })
  it('reports conversion only from decided leads', () => {
    const rows = sourceBreakdown(leads)
    expect(rows[0]).toMatchObject({ source: 'website', total: 3, open: 2, converted: 0, lost: 1, conversion: 0 })
    expect(rows.find((row) => row.source === 'referral')).toMatchObject({ converted: 1, conversion: 1 })
    expect(rows.find((row) => row.source === 'phone')?.conversion).toBeNull()
  })
  it('buckets intake into Monday-based weeks', () => {
    const weeks = weeklyCounts([{ created_at: iso(0) }, { created_at: iso(-2 * DAY) }, { created_at: iso(-3 * DAY) }, { created_at: iso(-400 * DAY) }, { created_at: 'bad' }], 'created_at', 4, now)
    expect(weeks.map((week) => week.count)).toEqual([0, 0, 1, 2])
    expect(new Date(weeks[3].start).getDay()).toBe(1)
  })
  it('values and weights deals by stage', () => {
    const deal = { status: 'open', stage: 'negotiation', base_amount: '100000', delivery_amount: 5000 }
    expect(dealValue(deal)).toBe(105000)
    expect(weightedDealValue(deal)).toBe(52500)
    expect(weightedDealValue({ ...deal, status: 'lost' })).toBe(0)
    expect(dealValue({ base_amount: 'abc' })).toBe(0)
  })
  it('matches every search term across fields', () => {
    expect(matchesSearch(['Jordan Ellis', 'Burleson, TX', null], 'ellis burleson')).toBe(true)
    expect(matchesSearch(['Jordan Ellis'], 'ellis austin')).toBe(false)
    expect(matchesSearch(['anything'], '   ')).toBe(true)
  })
})

describe('timeline classification', () => {
  it('reads logged touches from note metadata', () => {
    expect(timelineKind({ activity_type: 'note_added', metadata: { kind: 'call' } })).toBe('call')
    expect(timelineKind({ activity_type: 'note_added', metadata: { kind: 'unexpected' } })).toBe('note')
    expect(timelineKind({ activity_type: 'note_added', metadata: null })).toBe('note')
    expect(timelineKind({ activity_type: 'status_changed', title: 'Follow-up completed' })).toBe('task')
    expect(timelineKind({ activity_type: 'status_changed', title: 'Lead status updated' })).toBe('stage')
    expect(timelineKind({ activity_type: 'unit_sold' })).toBe('sale')
    expect(touchTitle('call', 'Left voicemail')).toBe('Call logged · Left voicemail')
    expect(touchTitle('note', '')).toBe('Note added')
  })
  it('filters conversations, notes, and record changes apart', () => {
    const call = { activity_type: 'note_added', metadata: { kind: 'call' } }
    const stage = { activity_type: 'status_changed', title: 'Lead status updated' }
    expect(matchesTimelineFilter(call, 'conversations')).toBe(true)
    expect(matchesTimelineFilter(call, 'notes')).toBe(false)
    expect(matchesTimelineFilter(stage, 'changes')).toBe(true)
    expect(matchesTimelineFilter(stage, 'all')).toBe(true)
  })
})

describe('CSV export', () => {
  it('quotes separators and neutralises spreadsheet formulas in customer text', () => {
    const csv = toCsv([{ name: 'Lane, Harper', note: '=HYPERLINK("http://x")', phone: '+1 817' }, { name: 'He said "hi"', note: null, phone: '555' }], [
      { header: 'Name', value: (row) => row.name }, { header: 'Note', value: (row) => row.note }, { header: 'Phone', value: (row) => row.phone },
    ])
    expect(csv.split('\r\n')).toEqual([
      'Name,Note,Phone',
      '"Lane, Harper","\'=HYPERLINK(""http://x"")",\'+1 817',
      '"He said ""hi""",,555',
    ])
  })
})

describe('QR inquiry handoff', () => {
  it('maps answers onto lead intake and keeps the originals in the summary', () => {
    const prefill = qrToLeadPrefill({ name: 'Sam  De La Cruz', email: 'sam@example.com', phone: '817-555-0100', location: 'Burleson, Texas', timing: 'In the next 30-90 days', units: '5-9 units', use: 'Workforce housing', payment: 'Financing', credit: 'Yes' })
    expect(prefill).toMatchObject({ first_name: 'Sam', last_name: 'De La Cruz', source: 'qr_code', project_type: 'Workforce housing', desired_timing: '1–3 months', project_location: 'Burleson, TX' })
    expect(prefill.summary).toContain('Units: 5-9 units')
    expect(prefill.summary).toContain('Payment: Financing (good credit: Yes)')
  })
})
