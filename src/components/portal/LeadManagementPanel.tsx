import { useMemo, useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { useCrmRows } from '../../hooks/useCrmRows'
import { useAction, useActor } from '../../hooks/useCrm'
import { updateLead } from '../../lib/crm/api'
import { leadAssigneeOptions, leadErrors, leadFormSchema, type LeadFieldErrors, type LeadFormValues } from '../../lib/lead-management'
import type { JsonRecord } from '../../lib/database.types'
import { LeadFormFields } from './LeadFormFields'

function nestedRecord(record: JsonRecord, key: string) {
  const value = record[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function valuesFromRecord(record: JsonRecord): LeadFormValues {
  const contact = nestedRecord(record, 'contacts')
  return {
    first_name: String(contact.first_name ?? ''),
    last_name: String(contact.last_name ?? ''),
    email: String(contact.email ?? ''),
    phone: String(contact.phone ?? ''),
    source: String(record.source ?? 'other') as LeadFormValues['source'],
    status: String(record.status ?? 'new') as LeadFormValues['status'],
    project_type: String(record.project_type ?? ''),
    project_location: String(record.project_location ?? ''),
    desired_timing: String(record.desired_timing ?? ''),
    summary: String(record.summary ?? ''),
    lost_reason: String(record.lost_reason ?? ''),
    assigned_employee_id: String(record.assigned_employee_id ?? ''),
  }
}

/**
 * Administrator edit of a lead: customer details, project, ownership, and
 * status in one audited save. Stage moves and conversion also live on the
 * record header, where representatives can use them for their own leads.
 */
export function LeadManagementPanel({ record, onSaved }: { record: JsonRecord; onSaved: () => void }) {
  const actor = useActor()
  const { run, busy } = useAction()
  const employees = useCrmRows('employees', { orderBy: 'display_name', ascending: true, limit: 500 })
  const [form, setForm] = useState<LeadFormValues>(() => valuesFromRecord(record))
  const [errors, setErrors] = useState<LeadFieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const assignees = useMemo(() => leadAssigneeOptions(employees.rows), [employees.rows])

  function update<Key extends keyof LeadFormValues>(field: Key, value: LeadFormValues[Key]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = leadFormSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(leadErrors(parsed.error))
      setError('Review the highlighted fields before updating this lead.')
      return
    }
    if (!parsed.data.assigned_employee_id) {
      setErrors((current) => ({ ...current, assigned_employee_id: 'Choose who owns this lead.' }))
      return
    }
    if (await run(() => updateLead(actor, record, parsed.data), 'Lead updated.')) onSaved()
  }

  return (
    <form className="lead-management-card" onSubmit={save} noValidate>
      {error ? <p className="lead-form-alert error" role="alert">{error}</p> : null}
      <LeadFormFields values={form} errors={errors} assignees={assignees} showStatus showAssignment disabled={busy} onChange={update} />
      <div className="lead-form-actions lead-management-actions">
        <span>Changing the owner also moves the customer and this lead’s open follow-ups. Every save is written to the timeline.</span>
        <div><button className="portal-primary-button" disabled={busy} type="submit"><Save size={15} /> {busy ? 'Saving…' : 'Save lead'}</button></div>
      </div>
    </form>
  )
}
