import type { JsonRecord } from './database.types'

/**
 * Local-preview data. It never reaches production: the preview flag requires
 * Vite dev mode, and every row here is invented. Preview edits mutate this
 * in-memory copy so the whole workflow can be exercised; a refresh resets it.
 */
const now = Date.now()
const HOUR = 3_600_000
const DAY = 86_400_000
const ago = (ms: number) => new Date(now - ms).toISOString()
const ahead = (ms: number) => new Date(now + ms).toISOString()

const ADMIN = '11111111-1111-4111-8111-111111111111'
const REP = '22222222-2222-4222-8222-222222222222'

// Deliberately minimal: the signed-in preview account, ONE sample sales
// representative, and ONE sample customer. That single customer carries just
// enough history (an open lead, a converted lead with its deal and quote, two
// follow-ups) to show every screen. Keep it this small.
export const portalFixtures: Record<string, JsonRecord[]> = {
  employees: [
    { id: ADMIN, display_name: 'Local Preview', first_name: 'Local', last_name: 'Preview', email: 'preview@cmaccontainers.com', role: 'admin', rep_code: 'CMAC-PREVIEW', active: true, auth_user_id: 'linked', updated_at: ago(0) },
    { id: REP, display_name: 'Demo Sales Rep', first_name: 'Demo', last_name: 'Rep', email: 'demo.rep@cmaccontainers.com', role: 'sales_rep', rep_code: 'CMAC-0002', active: true, auth_user_id: 'linked', updated_at: ago(0) },
  ],
  contacts: [
    { id: 'preview-contact-1', display_name: 'Taylor Morgan', first_name: 'Taylor', last_name: 'Morgan', email: 'taylor@example.com', phone: '(512) 555-0184', company: null, city: 'Austin', state: 'TX', postal_code: '78701', lifecycle_stage: 'prospect', project_address: 'Austin, TX', billing_address: null, assigned_employee_id: REP, created_by: ADMIN, updated_at: ago(2 * HOUR), created_at: ago(12 * DAY) },
  ],
  leads: [
    { id: 'preview-lead-1', contact_id: 'preview-contact-1', assigned_employee_id: REP, status: 'converted', source: 'website', project_type: 'Container home', project_location: 'Austin, TX', desired_timing: '1–3 months', summary: 'Flagship model and site review.', lost_reason: null, created_at: ago(12 * DAY), updated_at: ago(3 * DAY), converted_at: ago(3 * DAY) },
    { id: 'preview-lead-2', contact_id: 'preview-contact-1', assigned_employee_id: REP, status: 'new', source: 'website', project_type: 'Hospitality or guest suite', project_location: 'Austin, TX', desired_timing: '3–6 months', summary: 'Asked about adding a guest suite behind the main home.', lost_reason: null, created_at: ago(1 * DAY), updated_at: ago(1 * DAY), converted_at: null },
  ],
  tasks: [
    { id: 'preview-task-1', employee_id: REP, contact_id: 'preview-contact-1', lead_id: null, deal_id: 'preview-deal-1', title: 'Review Taylor site photos', description: 'Confirm truck and crane access.', due_at: ago(1 * HOUR), priority: 'urgent', status: 'open', completed_at: null, created_at: ago(2 * DAY), updated_at: ago(2 * DAY) },
    { id: 'preview-task-2', employee_id: REP, contact_id: 'preview-contact-1', lead_id: 'preview-lead-2', deal_id: null, title: 'Call Taylor about the guest suite', description: 'Discuss timing and finish package.', due_at: ahead(1 * DAY), priority: 'normal', status: 'open', completed_at: null, created_at: ago(1 * DAY), updated_at: ago(1 * DAY) },
  ],
  deals: [
    { id: 'preview-deal-1', contact_id: 'preview-contact-1', lead_id: 'preview-lead-1', sales_rep_id: REP, deal_number: 'CM-2026-0042', stage: 'quote', status: 'open', project_name: 'Morgan Container Home', project_address: 'Austin, TX', notes: 'Converted from website lead.\nFlagship model and site review.', base_amount: 50000, delivery_amount: 3500, deposit_percent: 10, delivery_estimate: '6–8 weeks', created_at: ago(3 * DAY), updated_at: ago(2 * HOUR), signed_at: null, closed_at: null },
  ],
  deal_units: [
    { id: 'preview-unit-1', deal_id: 'preview-deal-1', source: 'mock', external_unit_id: 'MODEL-LIVING-40', external_product_type: '40 ft Living Model', confirmed_by: null, confirmed_at: null, created_at: ago(3 * DAY), updated_at: ago(3 * DAY) },
  ],
  quotes: [
    { id: 'preview-quote-1', quote_number: 'Q-2026-0018', contact_id: 'preview-contact-1', lead_id: 'preview-lead-1', deal_id: 'preview-deal-1', employee_id: REP, status: 'sent', subtotal: 50000, tax: 0, delivery_amount: 3500, total: 53500, notes: 'Pricing holds for 30 days.', created_at: ago(2 * DAY), updated_at: ago(2 * HOUR), sent_at: ago(2 * HOUR), accepted_at: null, expired_at: null },
  ],
  quote_items: [
    { id: 'preview-quote-item-1', quote_id: 'preview-quote-1', description: '40 ft Living Model base configuration', quantity: 1, unit_price: 50000, line_total: 50000, display_order: 0, created_at: ago(2 * DAY) },
  ],
  contracts: [],
  unit_sales: [],
  marketing_sends: [
    { id: 'preview-send-1', employee_id: REP, contact_id: 'preview-contact-1', lead_id: 'preview-lead-1', subject: 'Explore CMAC Container Homes', recipient_email: 'taylor@example.com', status: 'sent', sent_at: ago(9 * DAY), created_at: ago(9 * DAY) },
  ],
  activities: [
    { id: 'preview-activity-1', activity_type: 'quote_sent', title: 'Quote Q-2026-0018 marked sent', description: 'External status updated manually.', metadata: {}, employee_id: REP, contact_id: 'preview-contact-1', lead_id: null, deal_id: 'preview-deal-1', created_at: ago(2 * HOUR) },
    { id: 'preview-activity-2', activity_type: 'lead_created', title: 'Website consultation received', description: 'Hospitality or guest suite · Austin, TX · 3–6 months', metadata: {}, employee_id: null, contact_id: 'preview-contact-1', lead_id: 'preview-lead-2', deal_id: null, created_at: ago(1 * DAY) },
    { id: 'preview-activity-3', activity_type: 'note_added', title: 'Call logged · Connected', description: 'Walked the lot by video. Utilities are at the road; wants the covered porch option.', metadata: { kind: 'call', outcome: 'Connected' }, employee_id: REP, contact_id: 'preview-contact-1', lead_id: null, deal_id: 'preview-deal-1', created_at: ago(2 * DAY) },
    { id: 'preview-activity-4', activity_type: 'deal_created', title: 'Draft deal created', description: 'CM-2026-0042 was created from this lead.', metadata: {}, employee_id: ADMIN, contact_id: 'preview-contact-1', lead_id: 'preview-lead-1', deal_id: 'preview-deal-1', created_at: ago(3 * DAY) },
    { id: 'preview-activity-5', activity_type: 'marketing_sent', title: 'Marketing email sent', description: 'Explore CMAC Container Homes', metadata: {}, employee_id: REP, contact_id: 'preview-contact-1', lead_id: 'preview-lead-1', deal_id: null, created_at: ago(9 * DAY) },
    { id: 'preview-activity-6', activity_type: 'lead_created', title: 'Website consultation received', description: 'Container home · Austin, TX · 1–3 months', metadata: {}, employee_id: null, contact_id: 'preview-contact-1', lead_id: 'preview-lead-1', deal_id: null, created_at: ago(12 * DAY) },
  ],
  marketing_materials: [],
  document_templates: [
    { id: 'preview-template-1', title: 'Purchase Agreement', slug: 'purchase-agreement', description: 'Unit, parties, price, terms, and signatures.', category: 'legal', is_active: false, provider: null, provider_template_id: null, display_order: 10 },
    { id: 'preview-template-2', title: 'Configuration & Finish Schedule', slug: 'configuration-finish-schedule', description: 'Exact layout, fixtures, finishes, and options.', category: 'transaction', is_active: false, provider: null, provider_template_id: null, display_order: 20 },
    { id: 'preview-template-3', title: 'Site Readiness Checklist', slug: 'site-readiness-checklist', description: 'Access, foundation, utilities, crane, and placement.', category: 'transaction', is_active: false, provider: null, provider_template_id: null, display_order: 30 },
  ],
}

const pick = (row: JsonRecord | undefined, keys: string[]) => row ? Object.fromEntries(keys.map((key) => [key, row[key]])) : null
const byId = (table: string, id: unknown) => id ? portalFixtures[table]?.find((row) => row.id === id) : undefined
const employeeRef = (id: unknown) => pick(byId('employees', id), ['id', 'display_name', 'rep_code', 'role', 'active'])
const contactRef = (id: unknown) => pick(byId('contacts', id), ['id', 'first_name', 'last_name', 'display_name', 'email', 'phone', 'company', 'project_address', 'city', 'state', 'assigned_employee_id'])

/** Rebuild the embedded relations that production selects through PostgREST joins. */
export function relinkFixtures() {
  for (const row of portalFixtures.contacts) { row.owner = employeeRef(row.assigned_employee_id); row.creator = employeeRef(row.created_by) }
  for (const row of portalFixtures.leads) { row.contacts = contactRef(row.contact_id); row.owner = employeeRef(row.assigned_employee_id); row.assigned_employee = row.owner }
  for (const row of portalFixtures.deals) { row.contacts = contactRef(row.contact_id); row.owner = employeeRef(row.sales_rep_id) }
  for (const row of portalFixtures.tasks) {
    row.contacts = contactRef(row.contact_id); row.owner = employeeRef(row.employee_id)
    row.deals = pick(byId('deals', row.deal_id), ['id', 'deal_number', 'project_name'])
  }
  for (const row of portalFixtures.quotes) {
    row.contacts = contactRef(row.contact_id); row.owner = employeeRef(row.employee_id)
    row.deals = pick(byId('deals', row.deal_id), ['id', 'deal_number', 'project_name', 'project_address'])
  }
  for (const row of portalFixtures.contracts) { row.contacts = contactRef(row.contact_id); row.owner = employeeRef(row.employee_id) }
  for (const row of portalFixtures.activities) {
    row.actor = employeeRef(row.employee_id); row.contacts = contactRef(row.contact_id)
    row.deals = pick(byId('deals', row.deal_id), ['id', 'deal_number'])
  }
}

relinkFixtures()

let sequence = 0

export function previewInsert(table: string, row: JsonRecord) {
  const stamp = new Date().toISOString()
  const full: JsonRecord = { id: `preview-${table}-new-${++sequence}`, created_at: stamp, updated_at: stamp, ...row }
  portalFixtures[table] = [full, ...(portalFixtures[table] ?? [])]
  relinkFixtures()
  return full
}

export function previewUpdate(table: string, id: string, patch: JsonRecord) {
  let updated: JsonRecord | null = null
  portalFixtures[table] = (portalFixtures[table] ?? []).map((row) => {
    if (row.id !== id) return row
    updated = { ...row, ...patch, updated_at: new Date().toISOString() }
    return updated
  })
  relinkFixtures()
  return updated as JsonRecord | null
}

export function previewDelete(table: string, id: string) {
  portalFixtures[table] = (portalFixtures[table] ?? []).filter((row) => row.id !== id)
  relinkFixtures()
}

export function previewNextNumber(prefix: string, table: string, key: string) {
  const highest = (portalFixtures[table] ?? []).reduce((max, row) => Math.max(max, Number(String(row[key] ?? '').split('-').pop()) || 0), 0)
  return `${prefix}-${new Date().getFullYear()}-${String(highest + 1).padStart(4, '0')}`
}
