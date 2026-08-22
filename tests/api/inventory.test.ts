import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import handler, { type ApiRequest, type ApiResponse } from '../../api/inventory'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

const mockedCreateClient = vi.mocked(createClient)

function makeResponse() {
  const state: { status?: number; body?: unknown; headers: Record<string, string>; ended: boolean } = { headers: {}, ended: false }
  const response: ApiResponse = {
    status: vi.fn((status: number) => { state.status = status; return response }),
    setHeader: vi.fn((name: string, value: string) => { state.headers[name] = value }),
    json: vi.fn((body: unknown) => { state.body = body }),
    end: vi.fn(() => { state.ended = true }),
  }
  return { response, state }
}

function request(authorization?: string): ApiRequest {
  return { method: 'GET', headers: authorization ? { authorization } : {} }
}

function crmClient(options?: { invalidUser?: boolean; inactiveEmployee?: boolean }) {
  const employeeQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(options?.inactiveEmployee
      ? { data: null, error: null }
      : { data: { id: 'employee-1', active: true, role: 'sales_rep' }, error: null }),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue(options?.invalidUser
      ? { data: { user: null }, error: new Error('invalid') }
      : { data: { user: { id: 'auth-user-1' } }, error: null }) },
    from: vi.fn().mockReturnValue(employeeQuery),
  }
}

function boltClient(result: { data: unknown; error: unknown }) {
  const inventoryQuery = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return { from: vi.fn().mockReturnValue(inventoryQuery) }
}

describe('GET /api/inventory', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://crm.example.test')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'crm-service-key')
    vi.stubEnv('BOLT_DATA_SUPABASE_URL', 'https://bolt.example.test')
    vi.stubEnv('BOLT_DATA_SUPABASE_SERVICE_ROLE_KEY', 'bolt-service-key')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('rejects unsupported methods', async () => {
    const { response, state } = makeResponse()
    await handler({ method: 'POST', headers: {} }, response)
    expect(state).toMatchObject({ status: 405, ended: true, headers: { Allow: 'GET' } })
  })

  it('reports missing server configuration without attempting a client connection', async () => {
    vi.stubEnv('BOLT_DATA_SUPABASE_SERVICE_ROLE_KEY', '')
    const { response, state } = makeResponse()
    await handler(request('Bearer token'), response)
    expect(state).toMatchObject({ status: 503, body: { error: { code: 'not_configured' } } })
    expect(mockedCreateClient).not.toHaveBeenCalled()
  })

  it('requires a bearer session', async () => {
    const { response, state } = makeResponse()
    await handler(request(), response)
    expect(state).toMatchObject({ status: 401, body: { error: { code: 'missing_session' } } })
  })

  it('rejects invalid sessions', async () => {
    mockedCreateClient.mockReturnValueOnce(crmClient({ invalidUser: true }) as never)
    const { response, state } = makeResponse()
    await handler(request('Bearer invalid'), response)
    expect(state).toMatchObject({ status: 401, body: { error: { code: 'invalid_session' } } })
  })

  it('rejects inactive or unallowlisted employees', async () => {
    mockedCreateClient.mockReturnValueOnce(crmClient({ inactiveEmployee: true }) as never)
    const { response, state } = makeResponse()
    await handler(request('Bearer valid'), response)
    expect(state).toMatchObject({ status: 403, body: { error: { code: 'inactive_employee' } } })
  })

  it('returns an honest upstream failure state', async () => {
    mockedCreateClient
      .mockReturnValueOnce(crmClient() as never)
      .mockReturnValueOnce(boltClient({ data: null, error: new Error('unavailable') }) as never)
    const { response, state } = makeResponse()
    await handler(request('Bearer valid'), response)
    expect(state).toMatchObject({ status: 502, body: { error: { code: 'inventory_unavailable' } } })
  })

  it('rejects an invalid synchronization timestamp', async () => {
    mockedCreateClient
      .mockReturnValueOnce(crmClient() as never)
      .mockReturnValueOnce(boltClient({ data: { available_inventory: 2, allocated_boss: 0, last_synced_at: 'not-a-date' }, error: null }) as never)
    const { response, state } = makeResponse()
    await handler(request('Bearer valid'), response)
    expect(state).toMatchObject({ status: 502, body: { error: { code: 'inventory_unavailable' } } })
  })

  it('returns valid zero inventory, timestamp, and private cache headers', async () => {
    mockedCreateClient
      .mockReturnValueOnce(crmClient() as never)
      .mockReturnValueOnce(boltClient({ data: { available_inventory: 0, allocated_boss: 3, last_synced_at: '2026-08-21T20:00:00Z' }, error: null }) as never)
    const { response, state } = makeResponse()
    await handler(request('Bearer valid'), response)
    expect(state).toMatchObject({
      status: 200,
      body: { available_inventory: 0, allocated_boss: 3, last_synced_at: '2026-08-21T20:00:00Z' },
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=30' },
    })
  })
})
