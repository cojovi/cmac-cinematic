import { describe, expect, it } from 'vitest'
import { activityActorName, activityPath, employeeName, fixtureDashboard, fixtureTeam, formatRecordDate } from './team-management'
import { portalFixtures } from './portal-fixtures'

describe('human-readable ownership and activity', () => {
  it('never leaks an internal identifier when the employee join is hidden', () => {
    expect(employeeName({ assigned_employee_id: 'secret-internal-id' })).toBe('Employee unavailable')
    expect(employeeName({ owner: { display_name: 'Riley Rep' } })).toBe('Riley Rep')
    expect(employeeName({})).toBe('Unassigned')
    expect(employeeName({}, 'creator', 'created_by')).toBe('System / website')
  })
  it('handles absent and invalid dates without crashing', () => {
    expect(formatRecordDate(null)).toBe('—')
    expect(formatRecordDate('not-a-date')).toBe('—')
    expect(formatRecordDate('2026-09-17T12:00:00Z')).toContain('2026')
  })
  it('does not present automated intake as a salesperson action', () => {
    expect(activityActorName({ activity_type: 'lead_created', title: 'Website consultation received', employee_id: 'rep', actor: { display_name: 'Rep A' } })).toBe('System / website')
  })
  it('links the most specific record from an activity', () => {
    expect(activityPath({ deal_id: 'deal', lead_id: 'lead', contact_id: 'contact' })).toBe('/employee-portal/deals/deal')
    expect(activityPath({ lead_id: 'lead' })).toBe('/employee-portal/leads/lead')
    expect(activityPath({ contact_id: 'contact' })).toBe('/employee-portal/customers/contact')
    expect(activityPath({})).toBeNull()
  })
  it('isolates workloads by employee in preview and excludes closed work', () => {
    const result = fixtureTeam(portalFixtures)
    const rep = result.employees.find(person => person.role === 'sales_rep')!
    expect(rep.contacts).toBe(2)
    expect(rep.leads).toBe(2)
    expect(rep.deals).toBe(1)
    expect(rep.tasks).toBe(2)
    expect(result.employees.find(person => person.role === 'admin')?.contacts).toBe(1)
    expect(fixtureDashboard({ leads: [{ status: 'new' }, { status: 'converted' }], tasks: [], quotes: [{status:'accepted'}] }).leads).toBe(1)
  })
})
