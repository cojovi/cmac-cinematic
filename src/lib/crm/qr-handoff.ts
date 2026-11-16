import type { LeadFormValues } from '../lead-management'

interface QrInquiry { name: string; email: string; phone: string; location: string; timing: string; units: string; use: string; payment: string; credit: string }

const timingMap: Record<string, string> = {
  'Immediately': 'As soon as possible',
  'In 30 days or less': 'As soon as possible',
  'In the next 30-90 days': '1–3 months',
  'Not sure, just curious to learn more': 'Just exploring',
}

const useMap: Record<string, string> = {
  'Short-term rental': 'Hospitality or guest suite',
  'Mother-in-law suite': 'Hospitality or guest suite',
  'Hunting or fishing cabin': 'Container home',
  'Workforce housing': 'Workforce housing',
}

/**
 * Turn an on-site QR inquiry into a lead-intake draft. The QR form asks which
 * lot the visitor saw, not where they will build, so that city is only a
 * starting point for the project location — the summary keeps every original
 * answer verbatim.
 */
export function qrToLeadPrefill(inquiry: QrInquiry): Partial<LeadFormValues> {
  const [first = '', ...rest] = inquiry.name.trim().split(/\s+/)
  const financing = inquiry.payment === 'Financing' ? `Financing (good credit: ${inquiry.credit || 'not answered'})` : inquiry.payment
  return {
    first_name: first,
    last_name: rest.join(' '),
    email: inquiry.email,
    phone: inquiry.phone,
    source: 'qr_code',
    project_type: useMap[inquiry.use] ?? 'Other custom space',
    project_location: inquiry.location.replace(', Texas', ', TX'),
    desired_timing: timingMap[inquiry.timing] ?? '',
    summary: [
      'From an on-site QR inquiry.',
      `Saw homes at: ${inquiry.location}`,
      `Wants to buy: ${inquiry.timing}`,
      `Units: ${inquiry.units}`,
      `Use: ${inquiry.use}`,
      `Payment: ${financing}`,
    ].join('\n'),
  }
}
