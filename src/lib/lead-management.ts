import { z } from 'zod'

export const leadSources = [
  { value: 'phone', label: 'Phone call' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'social', label: 'Social media' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
] as const

export const leadStatuses = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'nurturing', label: 'Nurturing' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'lost', label: 'Lost' },
  { value: 'archived', label: 'Archived' },
] as const

export const leadProjectTypes = [
  'Container home',
  'Workforce housing',
  'Office or studio',
  'Hospitality or guest suite',
  'Other custom space',
] as const

export const leadTimings = [
  'As soon as possible',
  '1–3 months',
  '3–6 months',
  '6+ months',
  'Just exploring',
] as const

const phoneSchema = z.string().trim().max(40).refine(
  (value) => value.replace(/\D/g, '').length >= 7,
  'Enter a phone number with at least 7 digits.',
)

export const leadFormSchema = z.object({
  first_name: z.string().trim().min(1, 'Enter a first name.').max(80),
  last_name: z.string().trim().max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  phone: phoneSchema,
  source: z.enum(['phone', 'referral', 'walk_in', 'social', 'website', 'other']),
  status: z.enum(['new', 'contacted', 'nurturing', 'qualified', 'lost', 'archived']),
  project_type: z.string().trim().min(1, 'Select a project type.').max(80),
  project_location: z.string().trim().min(2, 'Enter the project location.').max(160),
  desired_timing: z.string().trim().min(1, 'Select the desired timing.').max(80),
  summary: z.string().trim().max(2_000),
  lost_reason: z.string().trim().max(500),
  assigned_employee_id: z.union([z.literal(''), z.string().uuid('Choose an active salesperson.')]),
}).superRefine((value, context) => {
  if (value.status === 'lost' && value.lost_reason.length < 2) {
    context.addIssue({ code: 'custom', path: ['lost_reason'], message: 'Explain why this lead was lost.' })
  }
})

export type LeadFormValues = z.infer<typeof leadFormSchema>
export type LeadFieldErrors = Partial<Record<keyof LeadFormValues, string>>

export function leadErrors(error: z.ZodError<LeadFormValues>): LeadFieldErrors {
  const errors: LeadFieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof LeadFormValues | undefined
    if (field && !errors[field]) errors[field] = issue.message
  }
  return errors
}

export const emptyLeadForm: LeadFormValues = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  source: 'phone',
  status: 'new',
  project_type: '',
  project_location: '',
  desired_timing: '',
  summary: '',
  lost_reason: '',
  assigned_employee_id: '',
}

export function humanizeLeadValue(value: string) {
  return value.replaceAll('_', ' ')
}
