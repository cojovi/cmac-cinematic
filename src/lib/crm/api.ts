import type { JsonRecord } from '../database.types'
import { localPortalPreviewEnabled, supabase } from '../supabase'
import { runLeadAction } from '../lead-api'
import { runAdminAction } from '../admin-api'
import { portalFixtures, previewDelete, previewInsert, previewNextNumber, previewUpdate } from '../portal-fixtures'
import { invalidateCrm } from './bus'
import { touchTitle, type TouchKind } from './activity'
import { humanize, toNumber, type DealStage, type LeadStatus, type TaskPriority } from './pipeline'

/**
 * Every CRM write goes through this module. In production each function calls
 * Supabase (RLS and the audited edge functions stay authoritative). In local
 * preview the same functions edit the in-memory fixtures so the full workflow
 * can be reviewed without touching a database.
 */
const preview = localPortalPreviewEnabled

export interface Actor { id: string; role: string; display_name: string }

function db() {
  if (!supabase) throw new Error('The CRM is not configured in this environment.')
  return supabase
}

function fail(error: { message: string; code?: string } | null, fallback: string): never {
  if (error?.code === '23505') throw new Error('A record with that value already exists.')
  if (error?.code === '42501') throw new Error('You do not have permission to change this record.')
  throw new Error(error?.message || fallback)
}

interface LinkedRow { contact_id: string | null; lead_id: string | null; deal_id: string | null }

/**
 * Timeline entries and follow-ups must reference records the signed-in employee
 * can access. After an ownership transfer, a deal or lead someone still owns can
 * point at a customer who now belongs to a colleague; the insert policy rejects
 * that link. Rather than fail the save, keep the entry on the most specific
 * record the employee does own.
 */
function narrowerLink<Row extends LinkedRow>(row: Row): Row | null {
  if (row.deal_id && (row.contact_id || row.lead_id)) return { ...row, contact_id: null, lead_id: null }
  if (row.lead_id && row.contact_id) return { ...row, contact_id: null }
  return null
}

function previewActivity(row: JsonRecord) {
  previewInsert('activities', { metadata: {}, description: null, lead_id: null, deal_id: null, contact_id: null, ...row })
}

// --- Leads -----------------------------------------------------------------

export async function setLeadStatus(actor: Actor, lead: JsonRecord, status: LeadStatus, lostReason = '') {
  const id = String(lead.id)
  if (status === 'lost' && lostReason.trim().length < 2) throw new Error('Add a short reason before marking this lead lost.')
  if (preview) {
    previewUpdate('leads', id, { status, lost_reason: status === 'lost' ? lostReason.trim() : null })
    previewActivity({ activity_type: 'status_changed', title: 'Lead status updated', description: `${humanize(lead.status).toLowerCase()} → ${humanize(status).toLowerCase()}${status === 'lost' ? ` · ${lostReason.trim()}` : ''}`, metadata: { from: lead.status, to: status }, employee_id: actor.id, contact_id: lead.contact_id, lead_id: id })
  } else {
    await runLeadAction('set_status', { status, lost_reason: status === 'lost' ? lostReason.trim() : undefined }, id)
  }
  invalidateCrm('leads', 'activities')
}

export async function convertLead(actor: Actor, lead: JsonRecord): Promise<{ dealId: string; dealNumber: string }> {
  const id = String(lead.id)
  if (!lead.assigned_employee_id) throw new Error('Assign this lead to an employee before converting it.')
  let result: { dealId: string; dealNumber: string }
  if (preview) {
    const existing = portalFixtures.deals.find((deal) => deal.lead_id === id)
    const contact = portalFixtures.contacts.find((row) => row.id === lead.contact_id)
    const deal = existing ?? previewInsert('deals', {
      contact_id: lead.contact_id, lead_id: id, sales_rep_id: lead.assigned_employee_id, deal_number: previewNextNumber('CM', 'deals', 'deal_number'),
      stage: 'draft', status: 'open', project_name: [contact?.display_name, lead.project_type].filter(Boolean).join(' — '), project_address: lead.project_location,
      notes: [`Converted from ${humanize(lead.source).toLowerCase()} lead.`, lead.summary].filter(Boolean).join('\n'),
      base_amount: 0, delivery_amount: 0, deposit_percent: 10, delivery_estimate: null, signed_at: null, closed_at: null,
    })
    previewUpdate('leads', id, { status: 'converted', converted_at: new Date().toISOString() })
    if (contact && contact.lifecycle_stage !== 'customer') previewUpdate('contacts', String(contact.id), { lifecycle_stage: 'prospect' })
    previewActivity({ activity_type: 'deal_created', title: 'Draft deal created', description: `${String(deal.deal_number)} was created from this lead.`, employee_id: actor.id, contact_id: lead.contact_id, lead_id: id, deal_id: deal.id })
    result = { dealId: String(deal.id), dealNumber: String(deal.deal_number) }
  } else {
    const response = await runLeadAction('convert', { assigned_employee_id: String(lead.assigned_employee_id) }, id)
    if (!response.deal_id) throw new Error('The conversion completed without returning a deal record.')
    result = { dealId: response.deal_id, dealNumber: response.deal_number ?? '' }
  }
  invalidateCrm('leads', 'deals', 'contacts', 'activities', 'tasks')
  return result
}

export interface LeadDetails {
  first_name: string
  last_name: string
  email: string
  phone: string
  source: string
  status: string
  project_type: string
  project_location: string
  desired_timing: string
  summary: string
  lost_reason: string
  assigned_employee_id: string
}

/** Manual intake. Returns the new lead and who it was routed to (an existing customer keeps their current owner). */
export async function createLead(actor: Actor, details: LeadDetails): Promise<{ leadId: string; ownerId: string | null }> {
  const displayName = `${details.first_name} ${details.last_name}`.trim()
  let result: { leadId: string; ownerId: string | null }
  if (preview) {
    const email = details.email.toLowerCase()
    const existing = portalFixtures.contacts.find((contact) => String(contact.email).toLowerCase() === email)
    const ownerId = (actor.role === 'admin' ? details.assigned_employee_id : '') || String(existing?.assigned_employee_id ?? '') || (actor.role === 'admin' ? String(portalFixtures.employees.find((person) => person.role === 'sales_rep' && person.active)?.id ?? actor.id) : actor.id)
    const contact = existing ?? previewInsert('contacts', {
      first_name: details.first_name, last_name: details.last_name, display_name: displayName, email, phone: details.phone, company: null,
      project_address: details.project_location, billing_address: null, city: details.project_location, state: null, postal_code: null,
      lifecycle_stage: 'lead', assigned_employee_id: ownerId, created_by: actor.id,
    })
    const lead = previewInsert('leads', {
      contact_id: contact.id, assigned_employee_id: ownerId, status: 'new', source: details.source, project_type: details.project_type,
      project_location: details.project_location, desired_timing: details.desired_timing, summary: details.summary || null, lost_reason: null, converted_at: null,
    })
    previewActivity({ activity_type: 'lead_created', title: 'Manual lead created', description: [details.project_type, details.project_location, details.desired_timing].filter(Boolean).join(' · '), metadata: { source: details.source }, employee_id: actor.id, contact_id: contact.id, lead_id: lead.id })
    result = { leadId: String(lead.id), ownerId }
  } else {
    const response = await runLeadAction('create', { ...details, display_name: displayName })
    if (!response.lead_id) throw new Error('The lead was accepted but no record ID was returned.')
    result = { leadId: response.lead_id, ownerId: response.assigned_employee_id ?? null }
  }
  invalidateCrm('leads', 'contacts', 'activities')
  return result
}

/** Administrator edit of the customer and project details on a lead, including ownership. */
export async function updateLead(actor: Actor, lead: JsonRecord, details: LeadDetails) {
  const id = String(lead.id)
  const displayName = `${details.first_name} ${details.last_name}`.trim()
  if (preview) {
    previewUpdate('contacts', String(lead.contact_id), { first_name: details.first_name, last_name: details.last_name, display_name: displayName, email: details.email, phone: details.phone, project_address: details.project_location, assigned_employee_id: details.assigned_employee_id || lead.assigned_employee_id })
    previewUpdate('leads', id, { assigned_employee_id: details.assigned_employee_id || lead.assigned_employee_id, source: details.source, status: details.status, project_type: details.project_type, project_location: details.project_location, desired_timing: details.desired_timing, summary: details.summary || null, lost_reason: details.status === 'lost' ? details.lost_reason : null })
    previewActivity({ activity_type: details.status !== lead.status ? 'status_changed' : 'note_added', title: details.status !== lead.status ? 'Lead status updated' : 'Lead details updated', description: details.status !== lead.status ? `${humanize(lead.status).toLowerCase()} → ${humanize(details.status).toLowerCase()}` : 'Customer and project information was updated by an administrator.', employee_id: actor.id, contact_id: lead.contact_id, lead_id: id })
  } else {
    await runLeadAction('update', { ...details, display_name: displayName }, id)
  }
  invalidateCrm('leads', 'contacts', 'tasks', 'activities')
}

/** Administrator reassignment of a single lead through the audited lead workflow. Its customer and open follow-ups move with it. */
export async function reassignLead(lead: JsonRecord, employeeId: string) {
  const id = String(lead.id)
  if (preview) {
    previewUpdate('leads', id, { assigned_employee_id: employeeId })
    previewUpdate('contacts', String(lead.contact_id), { assigned_employee_id: employeeId })
    for (const task of portalFixtures.tasks) if (task.lead_id === id && task.status === 'open') previewUpdate('tasks', String(task.id), { employee_id: employeeId })
  } else {
    await runLeadAction('update', { assigned_employee_id: employeeId }, id)
  }
  invalidateCrm('leads', 'contacts', 'tasks', 'activities')
}

const leadHasDealMessage = 'This lead became a deal and is part of its history. It cannot be deleted.'
const contactHasHistoryMessage = 'This customer has deals, quotes, contracts, or sent marketing on record and cannot be deleted. Mark them inactive instead.'

/**
 * Permanently deletes a lead with its follow-ups and timeline entries. The
 * customer record stays. The server keeps a full copy in the audit log.
 */
export async function deleteLead(actor: Actor, lead: JsonRecord) {
  const id = String(lead.id)
  if (preview) {
    if (lead.status === 'converted' || portalFixtures.deals.some((deal) => deal.lead_id === id)) throw new Error(leadHasDealMessage)
    for (const table of ['tasks', 'activities']) for (const row of portalFixtures[table].filter((item) => item.lead_id === id)) previewDelete(table, String(row.id))
    previewDelete('leads', id)
    previewActivity({ activity_type: 'status_changed', title: 'Lead deleted', description: [lead.project_type, lead.project_location, humanize(lead.status).toLowerCase()].filter(Boolean).join(' · '), employee_id: actor.id, contact_id: lead.contact_id })
  } else {
    await runLeadAction('delete_lead', {}, id)
  }
  invalidateCrm('leads', 'tasks', 'activities')
}

/**
 * Permanently deletes a customer with their leads, follow-ups, and timeline.
 * Refused when the customer has deals, quotes, contracts, or sent marketing.
 */
export async function deleteContact(contact: JsonRecord) {
  const id = String(contact.id)
  if (preview) {
    if (['deals', 'quotes', 'contracts', 'marketing_sends'].some((table) => portalFixtures[table].some((row) => row.contact_id === id))) throw new Error(contactHasHistoryMessage)
    const leadIds = new Set(portalFixtures.leads.filter((lead) => lead.contact_id === id).map((lead) => lead.id))
    for (const table of ['tasks', 'activities']) for (const row of portalFixtures[table].filter((item) => item.contact_id === id || leadIds.has(item.lead_id))) previewDelete(table, String(row.id))
    for (const leadId of leadIds) previewDelete('leads', String(leadId))
    previewDelete('contacts', id)
  } else {
    await runLeadAction('delete_contact', {}, undefined, id)
  }
  invalidateCrm('contacts', 'leads', 'tasks', 'activities')
}

// --- Timeline --------------------------------------------------------------

export interface TouchInput {
  kind: TouchKind
  outcome: string
  body: string
  contactId: string | null
  leadId?: string | null
  dealId?: string | null
}

export async function logTouch(actor: Actor, input: TouchInput) {
  const body = input.body.trim()
  if (!body && input.kind === 'note') throw new Error('Write the note before saving it.')
  if (!input.contactId && !input.leadId && !input.dealId) throw new Error('This entry is not linked to a record.')
  const row = {
    contact_id: input.contactId, lead_id: input.leadId ?? null, deal_id: input.dealId ?? null, employee_id: actor.id,
    activity_type: 'note_added', title: touchTitle(input.kind, input.outcome), description: body || null,
    metadata: { kind: input.kind, outcome: input.outcome || null },
  }
  if (preview) previewActivity(row)
  else {
    let { error } = await db().from('activities').insert(row)
    const narrowed = error?.code === '42501' ? narrowerLink(row) : null
    if (narrowed) ({ error } = await db().from('activities').insert(narrowed))
    if (error) fail(error, 'The entry could not be saved.')
  }
  invalidateCrm('activities')
}

// --- Follow-ups ------------------------------------------------------------

export interface TaskInput {
  title: string
  description?: string
  dueAt: Date
  priority: TaskPriority
  employeeId: string
  contactId?: string | null
  leadId?: string | null
  dealId?: string | null
}

export async function createTask(actor: Actor, input: TaskInput) {
  const title = input.title.trim()
  if (!title) throw new Error('Describe the follow-up.')
  if (Number.isNaN(input.dueAt.getTime())) throw new Error('Choose a valid due date.')
  const row = {
    employee_id: input.employeeId, contact_id: input.contactId ?? null, lead_id: input.leadId ?? null, deal_id: input.dealId ?? null,
    title, description: input.description?.trim() || null, due_at: input.dueAt.toISOString(), priority: input.priority,
  }
  if (preview) {
    previewInsert('tasks', { ...row, status: 'open', completed_at: null })
    if (row.contact_id || row.lead_id || row.deal_id) previewActivity({ activity_type: 'follow_up_created', title: 'Follow-up scheduled', description: title, employee_id: actor.id, contact_id: row.contact_id, lead_id: row.lead_id, deal_id: row.deal_id })
  } else {
    let { error } = await db().from('tasks').insert(row)
    const narrowed = error?.code === '42501' ? narrowerLink(row) : null
    if (narrowed) ({ error } = await db().from('tasks').insert(narrowed))
    if (error) fail(error, 'The follow-up could not be saved.')
  }
  invalidateCrm('tasks', 'activities')
}

export async function updateTask(id: string, patch: { title?: string; description?: string | null; due_at?: string; priority?: TaskPriority; employee_id?: string }) {
  if (patch.title !== undefined && !patch.title.trim()) throw new Error('Describe the follow-up.')
  if (preview) previewUpdate('tasks', id, patch)
  else {
    const { data, error } = await db().from('tasks').update(patch).eq('id', id).select('id')
    if (error) fail(error, 'The follow-up could not be updated.')
    if (!data?.length) throw new Error('This follow-up changed or is no longer accessible. Refresh and try again.')
  }
  invalidateCrm('tasks')
}

export async function closeTask(actor: Actor, task: JsonRecord, status: 'completed' | 'cancelled') {
  const id = String(task.id)
  const patch = { status, completed_at: status === 'completed' ? new Date().toISOString() : null }
  if (preview) {
    previewUpdate('tasks', id, patch)
    if (task.contact_id || task.lead_id || task.deal_id) previewActivity({ activity_type: 'status_changed', title: `Follow-up ${status}`, description: task.title, employee_id: actor.id, contact_id: task.contact_id, lead_id: task.lead_id, deal_id: task.deal_id })
  } else {
    // The status guard makes a double click or a stale tab a no-op instead of a second timeline entry.
    const { data, error } = await db().from('tasks').update(patch).eq('id', id).eq('status', 'open').select('id')
    if (error) fail(error, 'The follow-up could not be updated.')
    if (!data?.length) throw new Error('This follow-up was already closed or is no longer accessible.')
  }
  invalidateCrm('tasks', 'activities')
}

export async function reopenTask(task: JsonRecord) {
  const id = String(task.id)
  const patch = { status: 'open', completed_at: null }
  if (preview) previewUpdate('tasks', id, patch)
  else {
    const { error } = await db().from('tasks').update(patch).eq('id', id)
    if (error) fail(error, 'The follow-up could not be reopened.')
  }
  invalidateCrm('tasks', 'activities')
}

// --- Contacts --------------------------------------------------------------

export interface ContactInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  project_address: string
  billing_address: string
  city: string
  state: string
  postal_code: string
  lifecycle_stage: string
}

function contactRow(input: ContactInput) {
  const first = input.first_name.trim()
  const last = input.last_name.trim()
  const email = input.email.trim().toLowerCase()
  if (!first) throw new Error('Enter a first name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  const optional = (value: string) => value.trim() || null
  return {
    first_name: first, last_name: last, display_name: `${first} ${last}`.trim(), email,
    phone: optional(input.phone), company: optional(input.company), project_address: optional(input.project_address),
    billing_address: optional(input.billing_address), city: optional(input.city), state: optional(input.state),
    postal_code: optional(input.postal_code), lifecycle_stage: input.lifecycle_stage,
  }
}

export async function createContact(actor: Actor, input: ContactInput): Promise<string> {
  const row = { ...contactRow(input), assigned_employee_id: actor.id, created_by: actor.id }
  let id: string
  if (preview) {
    if (portalFixtures.contacts.some((contact) => String(contact.email).toLowerCase() === row.email)) throw new Error('A contact with that email already exists.')
    id = String(previewInsert('contacts', row).id)
  } else {
    const { data, error } = await db().from('contacts').insert(row).select('id').single()
    if (error?.code === '23505') throw new Error('A contact with that email already exists. It may belong to another representative — ask an administrator to transfer it.')
    if (error || !data) fail(error, 'The contact could not be created.')
    id = String(data.id)
  }
  invalidateCrm('contacts')
  return id
}

export async function updateContact(id: string, input: ContactInput) {
  const row = contactRow(input)
  if (preview) previewUpdate('contacts', id, row)
  else {
    const { data, error } = await db().from('contacts').update(row).eq('id', id).select('id')
    if (error?.code === '23505') throw new Error('Another contact already uses that email address.')
    if (error) fail(error, 'The contact could not be updated.')
    if (!data?.length) throw new Error('This contact is no longer accessible. Refresh and try again.')
  }
  invalidateCrm('contacts', 'leads', 'deals')
}

/** Change only where a customer sits in the lifecycle — used to retire a customer whose sales history must be kept. */
export async function setContactLifecycle(id: string, stage: 'lead' | 'prospect' | 'customer' | 'inactive') {
  if (preview) previewUpdate('contacts', id, { lifecycle_stage: stage })
  else {
    const { data, error } = await db().from('contacts').update({ lifecycle_stage: stage }).eq('id', id).select('id')
    if (error) fail(error, 'The customer could not be updated.')
    if (!data?.length) throw new Error('This customer is no longer accessible. Refresh and try again.')
  }
  invalidateCrm('contacts')
}

export async function transferContact(contact: JsonRecord, employeeId: string) {
  if (preview) {
    const id = String(contact.id)
    previewUpdate('contacts', id, { assigned_employee_id: employeeId })
    for (const lead of portalFixtures.leads) if (lead.contact_id === id && !['converted', 'lost', 'archived'].includes(String(lead.status))) previewUpdate('leads', String(lead.id), { assigned_employee_id: employeeId })
    for (const deal of portalFixtures.deals) if (deal.contact_id === id && ['open', 'on_hold'].includes(String(deal.status))) previewUpdate('deals', String(deal.id), { sales_rep_id: employeeId })
    for (const task of portalFixtures.tasks) if (task.contact_id === id && task.status === 'open') previewUpdate('tasks', String(task.id), { employee_id: employeeId })
  } else {
    await runAdminAction({ action: 'reassign_contact', contact_id: contact.id, employee_id: employeeId, expected_owner_id: contact.assigned_employee_id ?? null })
  }
  invalidateCrm('contacts', 'leads', 'deals', 'tasks', 'quotes', 'activities')
}

// --- Deals -----------------------------------------------------------------

export interface DealPatch {
  stage?: DealStage
  status?: string
  project_name?: string | null
  project_address?: string | null
  notes?: string | null
  base_amount?: number
  delivery_amount?: number
  deposit_percent?: number
  delivery_estimate?: string | null
  closed_at?: string | null
}

export async function updateDeal(id: string, patch: DealPatch) {
  if (patch.stage === 'closed_won') throw new Error('Deals are marked won through the sale-completion step so unit attribution is recorded.')
  for (const key of ['base_amount', 'delivery_amount'] as const) {
    if (patch[key] !== undefined && (!Number.isFinite(patch[key]) || (patch[key] as number) < 0)) throw new Error('Amounts must be zero or more.')
  }
  if (patch.deposit_percent !== undefined && (!Number.isFinite(patch.deposit_percent) || patch.deposit_percent < 0 || patch.deposit_percent > 100)) throw new Error('Deposit must be between 0 and 100 percent.')
  if (preview) previewUpdate('deals', id, patch as JsonRecord)
  else {
    const { data, error } = await db().from('deals').update(patch).eq('id', id).select('id')
    if (error) fail(error, 'The deal could not be updated.')
    if (!data?.length) throw new Error('This deal is no longer accessible. Refresh and try again.')
  }
  invalidateCrm('deals', 'activities')
}

export async function closeDealLost(actor: Actor, deal: JsonRecord, reason: string) {
  const text = reason.trim()
  if (text.length < 2) throw new Error('Add a short reason before closing this deal.')
  await updateDeal(String(deal.id), { stage: 'closed_lost', status: 'lost', closed_at: new Date().toISOString() })
  await logTouch(actor, { kind: 'note', outcome: '', body: `Deal closed lost: ${text}`, contactId: String(deal.contact_id ?? '') || null, leadId: deal.lead_id ? String(deal.lead_id) : null, dealId: String(deal.id) })
}

export async function reopenDeal(deal: JsonRecord) {
  await updateDeal(String(deal.id), { stage: 'negotiation', status: 'open', closed_at: null })
}

export async function addDealUnit(actor: Actor, dealId: string, unitId: string, productType: string) {
  const row = { deal_id: dealId, source: 'manual', external_unit_id: unitId.trim(), external_product_type: productType.trim(), confirmed_by: actor.id, confirmed_at: new Date().toISOString() }
  if (!row.external_unit_id || !row.external_product_type) throw new Error('Enter the unit ID and product type.')
  if (preview) previewInsert('deal_units', row)
  else {
    const { error } = await db().from('deal_units').insert(row)
    if (error?.code === '23505') throw new Error('That unit is already on this deal.')
    if (error) fail(error, 'The unit could not be added.')
  }
  invalidateCrm('deal_units')
}

export async function removeDealUnit(id: string) {
  if (preview) previewDelete('deal_units', id)
  else {
    const { error } = await db().from('deal_units').delete().eq('id', id)
    if (error) fail(error, 'The unit could not be removed.')
  }
  invalidateCrm('deal_units')
}

/**
 * Marks a deal sold through the audited server workflow, which creates the
 * permanent unit-attribution records. The server re-checks every precondition;
 * the preview branch mirrors them so the flow can be rehearsed.
 */
export async function completeSale(actor: Actor, deal: JsonRecord, overrideReason: string): Promise<string> {
  const id = String(deal.id)
  let message: string
  if (preview) {
    const units = portalFixtures.deal_units.filter((unit) => unit.deal_id === id)
    if (!units.length) throw new Error('At least one unit reference is required')
    if (units.some((unit) => unit.source === 'mock' || !unit.confirmed_at)) throw new Error('Every unit must have a confirmed non-mock reference')
    const hasContract = portalFixtures.contracts.some((contract) => contract.deal_id === id && contract.status === 'completed')
    if (!hasContract && !(actor.role === 'admin' && overrideReason.trim().length >= 10)) throw new Error('A completed contract is required; admin overrides require a reason')
    previewUpdate('deals', id, { stage: 'closed_won', status: 'won', closed_at: new Date().toISOString() })
    for (const unit of units) previewInsert('unit_sales', { deal_id: id, employee_id: deal.sales_rep_id, external_unit_id: unit.external_unit_id, external_product_type: unit.external_product_type, sold_at: new Date().toISOString() })
    previewUpdate('contacts', String(deal.contact_id), { lifecycle_stage: 'customer' })
    previewActivity({ activity_type: 'unit_sold', title: 'Deal marked sold', description: `${units.length} unit sale record(s) created.`, employee_id: actor.id, contact_id: deal.contact_id, lead_id: deal.lead_id ?? null, deal_id: id })
    message = `Deal marked sold. ${units.length} unit sale record(s) created.`
  } else {
    const { data, error } = await db().functions.invoke('complete-unit-sale', { body: { deal_id: id, override_reason: overrideReason.trim() || undefined } })
    if (error) {
      let detail = error.message
      if ('context' in error && error.context instanceof Response) {
        try { detail = (await error.context.clone().json() as { error?: string }).error ?? detail } catch { /* keep the provider message */ }
      }
      throw new Error(detail)
    }
    message = String((data as { message?: string } | null)?.message ?? 'Deal completion recorded.')
  }
  invalidateCrm('deals', 'unit_sales', 'contacts', 'activities')
  return message
}

// --- Quotes ----------------------------------------------------------------

export interface QuoteLine { description: string; quantity: number; unit_price: number }

export function quoteSubtotal(lines: QuoteLine[]) {
  return lines.reduce((sum, line) => sum + toNumber(line.quantity) * toNumber(line.unit_price), 0)
}

function cleanLines(lines: QuoteLine[]) {
  const cleaned = lines.map((line) => ({ description: line.description.trim(), quantity: toNumber(line.quantity), unit_price: toNumber(line.unit_price) })).filter((line) => line.description)
  if (cleaned.some((line) => line.quantity <= 0 || line.unit_price < 0)) throw new Error('Each line needs a quantity above zero and a price of zero or more.')
  return cleaned
}

export async function createQuote(actor: Actor, deal: JsonRecord): Promise<string> {
  const base = toNumber(deal.base_amount)
  const lines: QuoteLine[] = base > 0 ? [{ description: `${String(deal.project_name ?? 'Container home')} — base configuration`, quantity: 1, unit_price: base }] : []
  // The quote belongs to the deal's representative so it shows in their workspace even when an administrator drafts it.
  const header = {
    contact_id: String(deal.contact_id), lead_id: deal.lead_id ? String(deal.lead_id) : null, deal_id: String(deal.id),
    employee_id: String(deal.sales_rep_id ?? actor.id),
    status: 'draft', subtotal: quoteSubtotal(lines), tax: 0, delivery_amount: toNumber(deal.delivery_amount),
  }
  let id: string
  if (preview) {
    const quote = previewInsert('quotes', { ...header, quote_number: previewNextNumber('Q', 'quotes', 'quote_number'), total: header.subtotal + header.delivery_amount, notes: null, sent_at: null, accepted_at: null, expired_at: null })
    id = String(quote.id)
    lines.forEach((line, index) => previewInsert('quote_items', { quote_id: id, ...line, line_total: line.quantity * line.unit_price, display_order: index }))
  } else {
    const { data, error } = await db().from('quotes').insert(header).select('id').single()
    if (error || !data) fail(error, 'The quote could not be created.')
    id = String(data.id)
    if (lines.length) {
      const { error: itemError } = await db().from('quote_items').insert(lines.map((line, index) => ({ quote_id: id, ...line, display_order: index })))
      if (itemError) fail(itemError, 'The quote was created, but its first line could not be saved. Open the quote to add it.')
    }
  }
  invalidateCrm('quotes', 'quote_items', 'activities')
  return id
}

export async function saveQuote(id: string, input: { lines: QuoteLine[]; tax: number; deliveryAmount: number; notes: string }) {
  const lines = cleanLines(input.lines)
  const tax = toNumber(input.tax)
  const delivery = toNumber(input.deliveryAmount)
  if (tax < 0 || delivery < 0) throw new Error('Tax and delivery must be zero or more.')
  const subtotal = quoteSubtotal(lines)
  const header = { subtotal, tax, delivery_amount: delivery, notes: input.notes.trim() || null }
  if (preview) {
    for (const item of portalFixtures.quote_items.filter((row) => row.quote_id === id)) previewDelete('quote_items', String(item.id))
    lines.forEach((line, index) => previewInsert('quote_items', { quote_id: id, ...line, line_total: line.quantity * line.unit_price, display_order: index }))
    previewUpdate('quotes', id, { ...header, total: subtotal + tax + delivery })
  } else {
    // Replace the lines, then write the header last so the stored total always matches saved lines.
    const { error: deleteError } = await db().from('quote_items').delete().eq('quote_id', id)
    if (deleteError) fail(deleteError, 'The quote lines could not be updated.')
    if (lines.length) {
      const { error: insertError } = await db().from('quote_items').insert(lines.map((line, index) => ({ quote_id: id, ...line, display_order: index })))
      if (insertError) fail(insertError, 'The quote lines could not be saved. Review them and save again.')
    }
    const { data, error } = await db().from('quotes').update(header).eq('id', id).select('id')
    if (error) fail(error, 'The quote totals could not be saved.')
    if (!data?.length) throw new Error('This quote is no longer accessible. Refresh and try again.')
  }
  invalidateCrm('quotes', 'quote_items', 'activities')
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'cancelled'

export async function setQuoteStatus(id: string, status: QuoteStatus) {
  const stamp = new Date().toISOString()
  const patch: { status: QuoteStatus; sent_at?: string; accepted_at?: string; expired_at?: string } = { status }
  if (status === 'sent') patch.sent_at = stamp
  if (status === 'accepted') patch.accepted_at = stamp
  if (status === 'expired') patch.expired_at = stamp
  if (preview) previewUpdate('quotes', id, patch)
  else {
    const { data, error } = await db().from('quotes').update(patch).eq('id', id).select('id')
    if (error) fail(error, 'The quote status could not be updated.')
    if (!data?.length) throw new Error('This quote is no longer accessible. Refresh and try again.')
  }
  invalidateCrm('quotes', 'activities')
}
