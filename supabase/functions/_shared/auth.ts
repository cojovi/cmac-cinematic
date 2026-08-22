import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3'

export interface EmployeeIdentity {
  id: string
  email: string
  display_name: string
  rep_code: string
  role: 'admin' | 'sales_rep'
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

export function serviceClient(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
}

export function userClient(request: Request): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: request.headers.get('authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireEmployee(request: Request, adminOnly = false) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return { error: 'Employee authentication is required.', status: 401 as const }
  const client = serviceClient()
  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData.user) return { error: 'The employee session is invalid or expired.', status: 401 as const }
  const { data, error } = await client.from('employees').select('id,email,display_name,rep_code,role,active').eq('auth_user_id', userData.user.id).eq('active', true).maybeSingle()
  if (error || !data || !['admin', 'sales_rep'].includes(String(data.role))) return { error: 'This CMAC employee account is not active.', status: 403 as const }
  if (adminOnly && data.role !== 'admin') return { error: 'Administrator access is required.', status: 403 as const }
  return { employee: data as EmployeeIdentity, token, client }
}

export function canAccessOwnedRecord(employee: EmployeeIdentity, ownerId: string | null | undefined) {
  return employee.role === 'admin' || ownerId === employee.id
}
