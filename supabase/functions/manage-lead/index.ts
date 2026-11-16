import { requireEmployee } from '../_shared/auth.ts'
import { json, options, parseJson } from '../_shared/http.ts'

type LeadAction = 'create' | 'update' | 'convert' | 'set_status' | 'delete_lead' | 'delete_contact'

interface LeadPayload {
  first_name?: string
  last_name?: string
  display_name?: string
  email?: string
  phone?: string
  source?: string
  status?: string
  project_type?: string
  project_location?: string
  desired_timing?: string
  summary?: string
  lost_reason?: string
  assigned_employee_id?: string
}

interface Input {
  action?: LeadAction
  lead_id?: string
  contact_id?: string
  lead?: LeadPayload
}

const actions: LeadAction[] = ['create', 'update', 'convert', 'set_status', 'delete_lead', 'delete_contact']
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options(request)
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405)

  const auth = await requireEmployee(request)
  if (!('employee' in auth)) return json(request, { error: auth.error }, auth.status)

  try {
    const input = await parseJson<Input>(request, 16_000)
    if (!input.action || !actions.includes(input.action)) {
      return json(request, { error: 'Choose a supported lead action.' }, 422)
    }
    // Deleting a lead or customer is open to any active employee for records they
    // own (administrators: any). The database function checks ownership, protects
    // sales history, and writes the audit copy.
    if (input.action === 'delete_lead' || input.action === 'delete_contact') {
      const kind = input.action === 'delete_lead' ? 'lead' : 'contact'
      const recordId = kind === 'lead' ? input.lead_id : input.contact_id
      if (!recordId || !uuidPattern.test(recordId)) {
        return json(request, { error: kind === 'lead' ? 'A valid lead ID is required.' : 'A valid customer ID is required.' }, 422)
      }
      const { data, error } = await auth.client.rpc('delete_crm_record', {
        p_actor_employee_id: auth.employee.id,
        p_kind: kind,
        p_record_id: recordId,
      })
      if (error) throw error
      return json(request, data, 200)
    }
    if (input.action !== 'create' && (!input.lead_id || !uuidPattern.test(input.lead_id))) {
      return json(request, { error: 'A valid lead ID is required.' }, 422)
    }
    // Editing details and reassigning stay administrator-only. Stage moves and
    // conversion are also allowed for the lead's owner; the database function
    // verifies ownership against the actor derived from this session.
    if (input.action === 'update' && auth.employee.role !== 'admin') {
      return json(request, { error: 'Administrator access is required to edit or reassign leads.' }, 403)
    }
    if (input.lead?.assigned_employee_id && !uuidPattern.test(input.lead.assigned_employee_id)) {
      return json(request, { error: 'Choose a valid salesperson.' }, 422)
    }

    const { data, error } = await auth.client.rpc('manage_lead', {
      p_actor_employee_id: auth.employee.id,
      p_action: input.action,
      p_lead_id: input.lead_id ?? null,
      p_payload: input.lead ?? {},
    })
    if (error) throw error
    return json(request, data, 200)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
    console.error('manage-lead failed', error instanceof Error ? error.message : 'unknown error')
    return json(request, {
      error: error instanceof Error ? error.message
        : error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message)
        : 'The lead action could not be completed.',
    }, code === '42501' ? 403 : 400)
  }
})
