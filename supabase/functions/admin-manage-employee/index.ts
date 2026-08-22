import { requireEmployee } from '../_shared/auth.ts'
import { json, options, parseJson } from '../_shared/http.ts'

interface Input { action?: string; employee_id?: string; employee?: { email?: string; first_name?: string; last_name?: string; display_name?: string; role?: string } }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options(request)
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405)
  const auth = await requireEmployee(request, true)
  if (!('employee' in auth)) return json(request, { error: auth.error }, auth.status)
  try {
    const input = await parseJson<Input>(request)
    if (!['create', 'activate', 'deactivate'].includes(input.action ?? '')) return json(request, { error: 'Unsupported employee action.' }, 422)
    if (input.action === 'create') {
      const email = input.employee?.email?.trim().toLowerCase() ?? ''
      if (!email.endsWith('@cmaccontainers.com') || !['admin', 'sales_rep'].includes(input.employee?.role ?? '') || !input.employee?.first_name?.trim() || !input.employee?.last_name?.trim()) return json(request, { error: 'A valid CMAC employee identity and role are required.' }, 422)
    } else if (!input.employee_id) return json(request, { error: 'Employee ID is required.' }, 422)
    const { data, error } = await auth.client.rpc('admin_manage_employee', { p_actor_employee_id: auth.employee.id, p_action: input.action, p_employee: input.employee ?? null, p_employee_id: input.employee_id ?? null })
    if (error) throw error
    return json(request, { message: 'Employee access updated.', result: data })
  } catch (error) {
    console.error('admin-manage-employee failed', error instanceof Error ? error.message : 'unknown error')
    return json(request, { error: error instanceof Error ? error.message : 'Employee access could not be updated.' }, 400)
  }
})
