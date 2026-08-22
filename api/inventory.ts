import { createClient } from '@supabase/supabase-js'

export interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

export interface ApiResponse {
  status: (code: number) => ApiResponse
  setHeader: (name: string, value: string) => void
  json: (body: unknown) => void
  end: () => void
}

function env(name: string) {
  return process.env[name]?.trim()
}

function sendError(response: ApiResponse, status: number, code: string, message: string) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.status(status).json({ error: { code, message } })
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).end()
    return
  }

  const crmUrl = env('SUPABASE_URL')
  const crmKey = env('SUPABASE_SERVICE_ROLE_KEY')
  const boltUrl = env('BOLT_DATA_SUPABASE_URL')
  const boltKey = env('BOLT_DATA_SUPABASE_SERVICE_ROLE_KEY')
  if (!crmUrl || !crmKey || !boltUrl || !boltKey) {
    sendError(response, 503, 'not_configured', 'Live inventory has not been configured for this environment.')
    return
  }

  const authorization = Array.isArray(request.headers.authorization) ? request.headers.authorization[0] : request.headers.authorization
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) {
    sendError(response, 401, 'missing_session', 'An employee session is required.')
    return
  }

  const crm = createClient(crmUrl, crmKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await crm.auth.getUser(token)
  if (userError || !userData.user) {
    sendError(response, 401, 'invalid_session', 'The employee session is invalid or expired.')
    return
  }

  const { data: employee, error: employeeError } = await crm
    .from('employees')
    .select('id,active,role')
    .eq('auth_user_id', userData.user.id)
    .eq('active', true)
    .in('role', ['admin', 'sales_rep'])
    .maybeSingle()
  if (employeeError || !employee) {
    sendError(response, 403, 'inactive_employee', 'The employee is not authorized for inventory access.')
    return
  }

  const bolt = createClient(boltUrl, boltKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await bolt
    .from('mini_homes_inventory')
    .select('available_inventory,allocated_boss,last_synced_at')
    .single()

  if (
    error
    || !data
    || typeof data.available_inventory !== 'number'
    || typeof data.allocated_boss !== 'number'
    || typeof data.last_synced_at !== 'string'
    || !Number.isFinite(Date.parse(data.last_synced_at))
  ) {
    sendError(response, 502, 'inventory_unavailable', 'Bolt-Data inventory is temporarily unavailable.')
    return
  }

  response.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=30')
  response.status(200).json({
    available_inventory: data.available_inventory,
    allocated_boss: data.allocated_boss,
    last_synced_at: data.last_synced_at,
  })
}
