import type { JsonRecord } from './database.types'

const now = Date.now()
const iso = (daysAgo = 0) => new Date(now - daysAgo * 86_400_000).toISOString()

export const portalFixtures: Record<string, JsonRecord[]> = {
  contacts: [
    { id: 'preview-contact-1', display_name: 'Taylor Morgan', first_name: 'Taylor', last_name: 'Morgan', email: 'taylor@example.com', phone: '(512) 555-0184', city: 'Austin', state: 'TX', lifecycle_stage: 'prospect', project_address: 'Austin, TX', updated_at: iso(0), created_at: iso(12) },
    { id: 'preview-contact-2', display_name: 'Avery Brooks', first_name: 'Avery', last_name: 'Brooks', email: 'avery@example.com', phone: '(225) 555-0137', city: 'Baton Rouge', state: 'LA', lifecycle_stage: 'lead', project_address: 'Baton Rouge, LA', updated_at: iso(1), created_at: iso(6) },
    { id: 'preview-contact-3', display_name: 'Meridian Workforce LLC', first_name: 'Meridian', last_name: 'Workforce', email: 'projects@example.com', phone: '(918) 555-0162', city: 'Tulsa', state: 'OK', lifecycle_stage: 'customer', project_address: 'Tulsa, OK', updated_at: iso(3), created_at: iso(24) },
  ],
  leads: [
    { id: 'preview-lead-1', contact_id: 'preview-contact-1', status: 'qualified', source: 'website', project_type: 'Turn-key living', project_location: 'Austin, TX', desired_timing: 'Within 90 days', summary: 'Flagship model and site review.', created_at: iso(1), updated_at: iso(0), contacts: { display_name: 'Taylor Morgan', email: 'taylor@example.com', phone: '(512) 555-0184' } },
    { id: 'preview-lead-2', contact_id: 'preview-contact-2', status: 'new', source: 'website', project_type: 'Custom space', project_location: 'Baton Rouge, LA', desired_timing: 'Researching', summary: 'Flexible office and guest suite.', created_at: iso(2), updated_at: iso(1), contacts: { display_name: 'Avery Brooks', email: 'avery@example.com', phone: '(225) 555-0137' } },
  ],
  tasks: [
    { id: 'preview-task-1', title: 'Review Taylor site photos', description: 'Confirm truck and crane access.', due_at: new Date(now - 3_600_000).toISOString(), priority: 'urgent', status: 'open', contacts: { display_name: 'Taylor Morgan' } },
    { id: 'preview-task-2', title: 'Call Avery Brooks', description: 'Discuss build timing and finish package.', due_at: new Date(now + 86_400_000).toISOString(), priority: 'normal', status: 'open', contacts: { display_name: 'Avery Brooks' } },
  ],
  deals: [
    { id: 'preview-deal-1', deal_number: 'CM-2026-0042', stage: 'quote', status: 'open', project_name: 'Morgan Container Home', base_amount: 50000, delivery_amount: 3500, deposit_percent: 10, updated_at: iso(0), contacts: { display_name: 'Taylor Morgan', email: 'taylor@example.com' } },
    { id: 'preview-deal-2', deal_number: 'CM-2026-0039', stage: 'contract', status: 'open', project_name: 'Meridian Crew Housing', base_amount: 150000, delivery_amount: 9000, deposit_percent: 20, updated_at: iso(2), contacts: { display_name: 'Meridian Workforce LLC', email: 'projects@example.com' } },
  ],
  quotes: [
    { id: 'preview-quote-1', quote_number: 'Q-2026-0018', status: 'sent', subtotal: 50000, tax: 0, delivery_amount: 3500, total: 53500, updated_at: iso(0), contacts: { display_name: 'Taylor Morgan' } },
  ],
  contracts: [
    { id: 'preview-contract-1', status: 'delivered', provider: 'docusign', created_at: iso(2), updated_at: iso(0), provider_envelope_id: 'demo-envelope-001', contacts: { display_name: 'Meridian Workforce LLC' } },
  ],
  activities: [
    { id: 'preview-activity-1', activity_type: 'quote_sent', title: 'Quote Q-2026-0018 marked sent', description: 'External status updated manually.', created_at: iso(0) },
    { id: 'preview-activity-2', activity_type: 'lead_created', title: 'New website inquiry', description: 'Avery Brooks requested a consultation.', created_at: iso(1) },
    { id: 'preview-activity-3', activity_type: 'contract_viewed', title: 'Contract delivered', description: 'Awaiting customer signature.', created_at: iso(2) },
  ],
  employees: [
    { id: 'preview-employee-1', display_name: 'Morgan Admin', first_name: 'Morgan', last_name: 'Admin', email: 'morgan@cmaccontainers.com', role: 'admin', rep_code: 'CMAC-0001', active: true, auth_user_id: 'linked', updated_at: iso(0) },
    { id: 'preview-employee-2', display_name: 'Demo Sales Rep', first_name: 'Demo', last_name: 'Rep', email: 'demo.rep@cmaccontainers.com', role: 'sales_rep', rep_code: 'CMAC-0002', active: true, auth_user_id: 'linked', updated_at: iso(0) },
  ],
  marketing_materials: [],
  document_templates: [
    { id: 'preview-template-1', title: 'Purchase Agreement', slug: 'purchase-agreement', description: 'Unit, parties, price, terms, and signatures.', category: 'legal', is_active: false, provider: null, provider_template_id: null, display_order: 10 },
    { id: 'preview-template-2', title: 'Configuration & Finish Schedule', slug: 'configuration-finish-schedule', description: 'Exact layout, fixtures, finishes, and options.', category: 'transaction', is_active: false, provider: null, provider_template_id: null, display_order: 20 },
    { id: 'preview-template-3', title: 'Site Readiness Checklist', slug: 'site-readiness-checklist', description: 'Access, foundation, utilities, crane, and placement.', category: 'transaction', is_active: false, provider: null, provider_template_id: null, display_order: 30 },
  ],
}
