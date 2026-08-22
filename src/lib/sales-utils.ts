export function quoteTotal(subtotal: number, tax: number, deliveryAmount: number) {
  const values = [subtotal, tax, deliveryAmount]
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Quote amounts must be finite and non-negative.')
  return values.reduce((sum, value) => sum + value, 0)
}

export function normalizeOperationalStatus(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  const map: Record<string, 'available' | 'allocated' | 'production' | 'sold' | 'unknown'> = {
    available: 'available', ready: 'available', in_stock: 'available',
    allocated: 'allocated', reserved: 'allocated', boss: 'allocated',
    production: 'production', in_production: 'production', building: 'production',
    sold: 'sold', closed: 'sold', delivered: 'sold',
  }
  return map[normalized] ?? 'unknown'
}
