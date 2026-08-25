import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, RefreshCw, Save, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { usePortalRows } from '../../hooks/usePortalRows'
import { runLeadAction } from '../../lib/lead-api'
import { leadErrors, leadFormSchema, type LeadFieldErrors, type LeadFormValues } from '../../lib/lead-management'
import type { JsonRecord } from '../../lib/database.types'
import { LeadFormFields, type SalespersonOption } from './LeadFormFields'

interface LeadManagementPanelProps {
  leadId: string
  record: JsonRecord
  linkedDeal?: JsonRecord
  onSaved: () => Promise<void>
}

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

export function LeadManagementPanel({ leadId, record, linkedDeal, onSaved }: LeadManagementPanelProps) {
  const navigate = useNavigate()
  const { previewMode } = useAuth()
  const employees = usePortalRows('employees', { orderBy: 'display_name', ascending: true, limit: 250 })
  const [form, setForm] = useState<LeadFormValues>(() => valuesFromRecord(record))
  const [errors, setErrors] = useState<LeadFieldErrors>({})
  const [busy, setBusy] = useState<'save' | 'convert' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isConverted = record.status === 'converted' || Boolean(linkedDeal)
  const salespeople = useMemo<SalespersonOption[]>(() => employees.rows
    .filter((row) => row.active && row.role === 'sales_rep')
    .map((row) => ({ id: String(row.id), displayName: String(row.display_name), repCode: String(row.rep_code) })), [employees.rows])

  function update<Key extends keyof LeadFormValues>(field: Key, value: LeadFormValues[Key]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setMessage(null)
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
    if (previewMode) {
      setMessage('Local preview only — the edit form is valid, but no CRM record was changed.')
      return
    }

    setBusy('save')
    setError(null)
    setMessage(null)
    try {
      const result = await runLeadAction('update', {
        ...parsed.data,
        display_name: `${parsed.data.first_name} ${parsed.data.last_name}`.trim(),
      }, leadId)
      setMessage(result.message ?? 'Lead updated successfully.')
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lead could not be updated.')
    } finally {
      setBusy(null)
    }
  }

  async function convert() {
    if (!form.assigned_employee_id) {
      setErrors((current) => ({ ...current, assigned_employee_id: 'Assign an active salesperson before conversion.' }))
      return
    }
    if (previewMode) {
      setMessage('Local preview only — conversion is ready, but no deal was created.')
      return
    }
    if (!window.confirm('Convert this lead into a new draft deal? The lead will be locked as converted and the salesperson will own the deal.')) return

    setBusy('convert')
    setError(null)
    setMessage(null)
    try {
      const result = await runLeadAction('convert', { assigned_employee_id: form.assigned_employee_id }, leadId)
      if (!result.deal_id) throw new Error('The conversion completed without returning a deal record.')
      navigate(`/employee-portal/deals/${result.deal_id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lead could not be converted.')
      setBusy(null)
    }
  }

  return (
    <form className="workspace-card lead-management-card" onSubmit={save} noValidate>
      <div className="workspace-card-heading lead-management-heading"><div><span>ADMIN / PIPELINE CONTROL</span><h3>{isConverted ? 'Converted lead record' : 'Edit, assign, and qualify'}</h3><p>Customer details, ownership, and pipeline changes are administrator-controlled and written to the activity trail.</p></div><ShieldCheck size={21} /></div>
      {message ? <p className="lead-form-alert success" role="status">{message}</p> : null}
      {error ? <p className="lead-form-alert error" role="alert">{error}</p> : null}
      <LeadFormFields
        values={form}
        errors={errors}
        salespeople={salespeople}
        showStatus
        showAssignment
        disabled={Boolean(busy) || isConverted}
        onChange={update}
      />
      <div className="lead-form-actions lead-management-actions">
        <span>{isConverted ? 'This lead is locked; continue work from its linked deal.' : 'Saving records the administrator change in the lead timeline.'}</span>
        <div>
          {linkedDeal ? <Link className="portal-secondary-button" to={`/employee-portal/deals/${String(linkedDeal.id)}`}>Open {String(linkedDeal.deal_number)} <ArrowRight size={15} /></Link> : null}
          {!isConverted ? <button className="portal-secondary-button" disabled={Boolean(busy)} type="button" onClick={() => void convert()}><RefreshCw size={15} /> {busy === 'convert' ? 'Converting…' : 'Convert to deal'}</button> : null}
          {!isConverted ? <button className="portal-primary-button" disabled={Boolean(busy)} type="submit"><Save size={15} /> {busy === 'save' ? 'Saving…' : 'Save lead'}</button> : null}
        </div>
      </div>
    </form>
  )
}
