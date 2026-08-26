import { describe, expect, it } from 'vitest'
import { publicLeadSchema, splitName } from './lead-validation'
import { mockInventoryProvider } from './inventory-provider'
import { quoteTotal, normalizeOperationalStatus } from './sales-utils'
import { isInventoryStale } from '../hooks/useInventorySummary'
import { authCallbackRoute, authCallbackUrl, canonicalAuthOrigin, canonicalGoogleLoginUrl, claimPkceRecovery, clearPkceRecovery, friendlyProviderError, hasOAuthResponse, providerErrorFromSearch } from './auth-flow'
import { leadFormSchema } from './lead-management'

describe('OAuth callback routing', () => {
  it('moves root-level OAuth responses to the dedicated callback without losing parameters', () => {
    expect(hasOAuthResponse('?code=one-time-code')).toBe(true)
    expect(authCallbackRoute('?code=one-time-code&next=portal')).toBe('/auth/callback?code=one-time-code&next=portal')
    expect(hasOAuthResponse('?utm_source=campaign')).toBe(false)
  })

  it('builds an exact callback URL and surfaces provider errors', () => {
    expect(authCallbackUrl('https://cmac-cinematic.vercel.app/')).toBe('https://cmac-cinematic.vercel.app/auth/callback')
    expect(providerErrorFromSearch('?error=access_denied&error_description=Workspace+access+denied')).toBe('Workspace access denied')
  })

  it('moves generated Vercel deployments to the stable production origin before OAuth', () => {
    const preview = 'https://cmac-cinematic-abc123-cojovis-projects.vercel.app'
    expect(canonicalAuthOrigin(preview)).toBe('https://cmac-cinematic.vercel.app')
    expect(canonicalGoogleLoginUrl(preview)).toBe('https://cmac-cinematic.vercel.app/login?continue=google')
    expect(canonicalAuthOrigin('http://localhost:5173')).toBe('http://localhost:5173')
  })

  it('allows only one automatic PKCE recovery inside the retry window', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    expect(claimPkceRecovery(storage, 1_000)).toBe(true)
    expect(claimPkceRecovery(storage, 2_000)).toBe(false)
    clearPkceRecovery(storage)
    expect(claimPkceRecovery(storage, 2_000)).toBe(true)
  })

  it('does not expose raw provider errors to the callback screen', () => {
    expect(friendlyProviderError('?error=server_error&error_description=internal+provider+detail'))
      .toBe('Google could not complete sign-in. Please try again with an authorized CMAC account.')
  })
})

describe('public lead validation', () => {
  const valid = { name: 'Taylor Morgan', phone: '(512) 555-0184', email: 'Taylor@Example.com', projectType: 'Container home', location: 'Austin, TX', timing: '1–3 months', website: '' }
  it('normalizes canonical email and accepts valid fields', () => expect(publicLeadSchema.parse(valid).email).toBe('taylor@example.com'))
  it('rejects honeypot input and malformed email', () => {
    expect(publicLeadSchema.safeParse({ ...valid, website: 'bot' }).success).toBe(false)
    expect(publicLeadSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false)
    expect(publicLeadSchema.safeParse({ ...valid, phone: 'one' }).success).toBe(false)
  })
  it('splits multi-part names without losing surnames', () => expect(splitName('Avery Van Buren')).toEqual({ firstName: 'Avery', lastName: 'Van Buren' }))
})

describe('employee lead validation', () => {
  const valid = {
    first_name: 'Taylor', last_name: 'Morgan', email: 'taylor@example.com', phone: '(512) 555-0184',
    source: 'referral', status: 'qualified', project_type: 'Container home', project_location: 'Austin, TX',
    desired_timing: '1–3 months', summary: '', lost_reason: '', assigned_employee_id: '20000000-0000-4000-8000-000000000002',
  }
  it('accepts a complete manually entered lead', () => expect(leadFormSchema.safeParse(valid).success).toBe(true))
  it('requires a reason before a lead can be marked lost', () => expect(leadFormSchema.safeParse({ ...valid, status: 'lost' }).success).toBe(false))
})

describe('inventory contracts', () => {
  it('marks inventory stale after one hour and treats invalid timestamps as stale', () => {
    const now = new Date('2026-08-21T12:00:00Z').getTime()
    expect(isInventoryStale('2026-08-21T11:00:01Z', now)).toBe(false)
    expect(isInventoryStale('2026-08-21T10:59:59Z', now)).toBe(true)
    expect(isInventoryStale('invalid', now)).toBe(true)
  })
  it('keeps per-unit cards explicitly isolated as mock records', async () => {
    const units = await mockInventoryProvider.getUnits()
    expect(mockInventoryProvider.source).toBe('mock')
    expect(units.length).toBeGreaterThan(0)
    expect(units.every((unit) => unit.source === 'mock')).toBe(true)
  })
  it('normalizes known operational statuses without guessing unknown values', () => {
    expect(normalizeOperationalStatus('In Production')).toBe('production')
    expect(normalizeOperationalStatus('Reserved')).toBe('allocated')
    expect(normalizeOperationalStatus('mystery')).toBe('unknown')
  })
})

describe('quote totals', () => {
  it('adds subtotal, tax, and delivery', () => expect(quoteTotal(50_000, 4_125, 3_500)).toBe(57_625))
  it('rejects negative or non-finite values', () => {
    expect(() => quoteTotal(50_000, -1, 0)).toThrow()
    expect(() => quoteTotal(Number.NaN, 0, 0)).toThrow()
  })
})
