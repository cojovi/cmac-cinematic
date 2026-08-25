import { z } from 'zod'

export const publicLeadSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  phone: z.string().trim().max(40).refine(
    (value) => value.replace(/\D/g, '').length >= 7,
    'Enter a phone number with at least 7 digits.',
  ),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  projectType: z.string().trim().min(1, 'Select a project type.').max(80),
  location: z.string().trim().min(2, 'Enter the project location.').max(160),
  timing: z.string().trim().min(1, 'Select your ideal timing.').max(80),
  website: z.string().max(0, 'Unable to accept submission.'),
})

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}
