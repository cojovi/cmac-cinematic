import { describe, expect, it } from 'vitest'
import { publicLeadSchema, splitName } from './lead-validation'
import { mockInventoryProvider } from './inventory-provider'
import { quoteTotal, normalizeOperationalStatus } from './sales-utils'
import { isInventoryStale } from '../hooks/useInventorySummary'
import { authCallbackRoute, authCallbackUrl, hasOAuthResponse, providerErrorFromSearch } from './auth-flow'

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
})

describe('public lead validation', () => {
  const valid = { name: 'Taylor Morgan', phone: '(512) 555-0184', email: 'Taylor@Example.com', projectType: 'Container home', location: 'Austin, TX', timing: '1–3 months', website: '' }
  it('normalizes canonical email and accepts valid fields', () => expect(publicLeadSchema.parse(valid).email).toBe('taylor@example.com'))
  it('rejects honeypot input and malformed email', () => {
    expect(publicLeadSchema.safeParse({ ...valid, website: 'bot' }).success).toBe(false)
    expect(publicLeadSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false)
  })
  it('splits multi-part names without losing surnames', () => expect(splitName('Avery Van Buren')).toEqual({ firstName: 'Avery', lastName: 'Van Buren' }))
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
