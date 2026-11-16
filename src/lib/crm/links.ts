import type { JsonRecord } from '../database.types'
import { related } from '../team-management'

/** The most specific record a follow-up belongs to, for linking from global lists. */
export function taskRecordLink(task: JsonRecord) {
  const name = String(related(task, 'contacts')?.display_name ?? '')
  if (task.deal_id) return { to: `/employee-portal/deals/${String(task.deal_id)}`, label: String(related(task, 'deals')?.deal_number ?? name) || 'Deal' }
  if (task.lead_id) return { to: `/employee-portal/leads/${String(task.lead_id)}`, label: name || 'Lead' }
  if (task.contact_id) return { to: `/employee-portal/customers/${String(task.contact_id)}`, label: name || 'Customer' }
  return null
}

export function contactOf(row: JsonRecord | undefined) {
  return related(row, 'contacts') ?? {}
}
