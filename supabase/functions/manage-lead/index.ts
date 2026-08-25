import { requireEmployee } from '../_shared/auth.ts'
import { json, options, parseJson } from '../_shared/http.ts'

type LeadAction = 'create' | 'update' | 'convert'

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
  lead?: LeadPayload
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options(request)
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405)

  const auth = await requireEmployee(request)
  if (!('employee' in auth)) return json(request, { error: auth.error }, auth.status)

  try {
    const input = await parseJson<Input>(request, 16_000)
    if (!input.action || !['create', 'update', 'convert'].includes(input.action)) {
      return json(request, { error: 'Choose a supported lead action.' }, 422)
    }
    if (input.action !== 'create' && (!input.lead_id || !uuidPattern.test(input.lead_id))) {
      return json(request, { error: 'A valid lead ID is required.' }, 422)
    }
    if (input.action !== 'create' && auth.employee.role !== 'admin') {
      return json(request, { error: 'Administrator access is required to edit or convert leads.' }, 403)
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
    console.error('manage-lead failed', error instanceof Error ? error.message : 'unknown error')
    return json(request, {
      error: error instanceof Error ? error.message : 'The lead action could not be completed.',
    }, 400)
  }
})
