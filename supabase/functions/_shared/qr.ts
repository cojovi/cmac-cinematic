// Shared by the public form and Edge Function. No credentials or runtime imports.
export const qrRecipient = 'charleyc@cmaccontainers.com'
export const qrOptions = {
  location: ['Burleson, Texas', 'Weatherford, Texas'],
  timing: ['Immediately', 'In 30 days or less', 'In the next 30-90 days', 'Not sure, just curious to learn more'],
  units: ['1-4 units', '5-9 units', '10+ units'],
  use: ['Short-term rental', 'Mother-in-law suite', 'Hunting or fishing cabin', 'Workforce housing'],
  payment: ['Cash', 'Financing'],
  credit: ['Yes', 'No'],
} as const
export const qrQuestions = {
  location: 'Which location did you see our container homes?',
  timing: 'How soon are you wanting to buy a container home?',
  units: 'How many units are you interested in buying?',
  use: 'What will you be using the container homes for?',
  payment: 'Will you be paying cash or do you need financing?',
  credit: 'If you need financing, do you have good credit?',
} as const
export type QrAnswers = { -readonly [K in keyof typeof qrOptions]: string } & { name: string; email: string; phone: string }
export type QrErrors = Partial<Record<keyof QrAnswers, string>>
export const emptyQrAnswers: QrAnswers = { location: '', timing: '', units: '', use: '', payment: '', credit: '', name: '', email: '', phone: '' }
export function validateQrAnswers(input: unknown): { data: QrAnswers; errors: QrErrors } {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const data = Object.fromEntries(Object.keys(emptyQrAnswers).map(key => [key, typeof value[key] === 'string' ? value[key].trim() : ''])) as QrAnswers
  data.email = data.email.toLowerCase()
  if (data.payment === 'Cash') data.credit = ''
  const errors: QrErrors = {}
  for (const key of Object.keys(qrOptions) as (keyof typeof qrOptions)[]) {
    if (key === 'credit' && data.payment !== 'Financing') continue
    if (!(qrOptions[key] as readonly string[]).includes(data[key])) errors[key] = 'Choose one of the options below.'
  }
  if (data.name.length < 2 || data.name.length > 120 || /[\r\n]/.test(data.name)) errors.name = 'Enter your full name (2–120 characters).'
  if (data.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email)) errors.email = 'Enter a valid email address.'
  const digits = data.phone.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15 || data.phone.length > 40 || !/^[+\d\s().-]+$/.test(data.phone)) errors.phone = 'Enter a phone number with 7–15 digits.'
  return { data, errors }
}
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
export type QrEmailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'not_configured' | 'unknown'
export function qrEmailBody(answers: QrAnswers, receipt: string) {
  return [
    'New CMAC Container Homes QR inquiry', `Reference: ${receipt}`, '',
    `Name: ${answers.name}`, `Email: ${answers.email}`, `Phone: ${answers.phone}`, '',
    ...Object.entries(qrQuestions).map(([key, question], index) => `${index + 1}. ${question}\n${answers[key as keyof QrAnswers] || 'Not applicable (paying cash)'}`), '',
    'Source: https://www.cmaccontainers.com/qr',
    'Credit is self-reported. This inquiry is not a credit application or approval.',
  ].join('\n')
}
