import type { JsonRecord } from './database.types'

export const activitySelect = '*,actor:employees!activities_employee_id_fkey(display_name,rep_code),contacts(display_name),deals(deal_number)'
export const employeeSelect = 'id,display_name,rep_code,active,role'

export function related(row: JsonRecord | undefined, key: string): JsonRecord | null {
  const value = row?.[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

export function employeeName(row: JsonRecord | undefined, relation = 'owner', idField = 'assigned_employee_id') {
  const person = related(row, relation)
  if (person?.display_name) return String(person.display_name)
  return row?.[idField] ? 'Employee unavailable' : relation === 'creator' || relation === 'actor' ? 'System / website' : 'Unassigned'
}

export function formatRecordDate(value: unknown) {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function activityPath(row: JsonRecord) {
  if (row.deal_id) return `/employee-portal/deals/${String(row.deal_id)}`
  if (row.lead_id) return `/employee-portal/leads/${String(row.lead_id)}`
  if (row.contact_id) return `/employee-portal/customers/${String(row.contact_id)}`
  return null
}

export function activityActorName(row: JsonRecord) {
  // The original public-intake logger stored the assignee as employee_id.
  // Receipt of a website form is an automated event, not an action by that rep.
  if (row.activity_type === 'lead_created' && row.title === 'Website consultation received') return 'System / website'
  return employeeName(row, 'actor', 'employee_id')
}

export interface TeamEmployee extends JsonRecord {
  id: string; display_name: string; first_name: string; last_name: string; email: string
  role: 'admin' | 'sales_rep'; rep_code: string; active: boolean; linked: boolean
  contacts: number; leads: number; deals: number; tasks: number; overdue: number; units_sold: number
  last_activity_at: string | null
}
export interface TeamOverview { employees: TeamEmployee[]; unassigned_contacts: number; unassigned_leads: number; as_of: string }
export interface DashboardSummary { leads: number; new_leads: number; tasks: number; due_tasks: number; quotes: number; contracts: number; units_sold: number }

export function fixtureDashboard(tables: Record<string, JsonRecord[]>): DashboardSummary {
  const open = (tables.tasks ?? []).filter(row => row.status === 'open')
  return {
    leads: (tables.leads ?? []).filter(row => !['converted', 'lost', 'archived'].includes(String(row.status))).length,
    new_leads: (tables.leads ?? []).filter(row => row.status === 'new').length,
    tasks: open.length, due_tasks: open.filter(row => new Date(String(row.due_at)).getTime() <= Date.now()).length,
    quotes: (tables.quotes ?? []).filter(row => ['draft', 'sent'].includes(String(row.status))).length,
    contracts: (tables.contracts ?? []).length, units_sold: (tables.unit_sales ?? []).length,
  }
}

export function fixtureTeam(tables: Record<string, JsonRecord[]>): TeamOverview {
  return {
    employees: (tables.employees ?? []).map(person => {
      const owned = Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.filter(row => (row.assigned_employee_id ?? row.sales_rep_id ?? row.employee_id) === person.id)]))
      const totals = fixtureDashboard(owned)
      return { ...person, id: String(person.id), display_name: String(person.display_name), first_name: String(person.first_name), last_name: String(person.last_name),
        email: String(person.email), role: person.role === 'admin' ? 'admin' : 'sales_rep', rep_code: String(person.rep_code), active: Boolean(person.active),
        linked: Boolean(person.auth_user_id), ...totals, contacts: owned.contacts.length,
        deals: owned.deals.filter(row => ['open', 'on_hold'].includes(String(row.status))).length,
        overdue: totals.due_tasks, last_activity_at: owned.activities[0]?.created_at ? String(owned.activities[0].created_at) : null }
    }),
    unassigned_contacts: (tables.contacts ?? []).filter(row => !row.assigned_employee_id).length,
    unassigned_leads: (tables.leads ?? []).filter(row => !row.assigned_employee_id && !['converted','lost','archived'].includes(String(row.status))).length,
    as_of: new Date().toISOString(),
  }
}
