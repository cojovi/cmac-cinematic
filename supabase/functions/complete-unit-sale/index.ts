import { requireEmployee, serviceClient } from '../_shared/auth.ts'
import { json, options, parseJson } from '../_shared/http.ts'

interface Input { deal_id?: string; override_reason?: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options(request)
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405)
  const auth = await requireEmployee(request)
  if (!('employee' in auth)) return json(request, { error: auth.error }, auth.status)
  try {
    const input = await parseJson<Input>(request)
    if (!input.deal_id) return json(request, { error: 'Deal ID is required.' }, 422)
    if (input.override_reason && auth.employee.role !== 'admin') return json(request, { error: 'Only administrators may supply a completion override.' }, 403)
    const client = serviceClient()
    const { data, error } = await client.rpc('complete_deal_sale', {
      p_deal_id: input.deal_id,
      p_actor_employee_id: auth.employee.id,
      p_override_reason: input.override_reason?.trim() || null,
    })
    if (error) throw error
    return json(request, { message: 'Deal completion recorded.', result: data })
  } catch (error) {
    console.error('complete-unit-sale failed', error instanceof Error ? error.message : 'unknown error')
    return json(request, { error: error instanceof Error ? error.message : 'The deal could not be completed.' }, 409)
  }
})
