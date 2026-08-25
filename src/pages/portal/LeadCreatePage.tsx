import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, BriefcaseBusiness, Save, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { LeadFormFields, type SalespersonOption } from '../../components/portal/LeadFormFields'
import { ConfigurationState, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { useAuth } from '../../auth/useAuth'
import { usePortalRows } from '../../hooks/usePortalRows'
import { runLeadAction } from '../../lib/lead-api'
import { emptyLeadForm, leadErrors, leadFormSchema, type LeadFormValues, type LeadFieldErrors } from '../../lib/lead-management'

export default function LeadCreatePage() {
  const navigate = useNavigate()
  const { employee, previewMode } = useAuth()
  const employees = usePortalRows('employees', { orderBy: 'display_name', ascending: true, limit: 250 })
  const [form, setForm] = useState<LeadFormValues>(() => ({
    ...emptyLeadForm,
    assigned_employee_id: employee?.role === 'sales_rep' ? employee.id : '',
  }))
  const [errors, setErrors] = useState<LeadFieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const isAdmin = employee?.role === 'admin'
  const salespeople = useMemo<SalespersonOption[]>(() => employees.rows
    .filter((row) => row.active && row.role === 'sales_rep')
    .map((row) => ({ id: String(row.id), displayName: String(row.display_name), repCode: String(row.rep_code) })), [employees.rows])

  function update<Key extends keyof LeadFormValues>(field: Key, value: LeadFormValues[Key]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    const parsed = leadFormSchema.safeParse({
      ...form,
      status: 'new',
      assigned_employee_id: isAdmin ? form.assigned_employee_id : employee?.id ?? '',
    })
    if (!parsed.success) {
      setErrors(leadErrors(parsed.error))
      setError('Review the highlighted fields before saving this lead.')
      return
    }
    if (previewMode) {
      setMessage('Local preview only — the form is valid, but no lead was written to the CRM.')
      return
    }

    setBusy(true)
    try {
      const result = await runLeadAction('create', {
        ...parsed.data,
        display_name: `${parsed.data.first_name} ${parsed.data.last_name}`.trim(),
      })
      if (!result.lead_id) throw new Error('The lead was accepted but no record ID was returned.')
      if (employee?.role === 'sales_rep' && result.assigned_employee_id !== employee.id) {
        setMessage('Lead recorded and routed to the customer’s existing salesperson. It is outside your assigned queue.')
        return
      }
      navigate(`/employee-portal/leads/${result.lead_id}`, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lead could not be created.')
    } finally {
      setBusy(false)
    }
  }

  if (employees.loading) return <PortalLoading label="Preparing lead intake" />
  if (employees.error) return <PortalError message={employees.error} />

  return (
    <section className="lead-create-page" aria-labelledby="lead-create-heading">
      <Link className="portal-text-button detail-back" to="/employee-portal/leads"><ArrowLeft size={15} /> Back to leads</Link>
      <div className="workspace-view-heading lead-create-heading">
        <div><span>CRM / MANUAL INTAKE</span><h2 id="lead-create-heading">Create a lead</h2><p>Capture phone calls, referrals, walk-ins, and other opportunities in the same accountable pipeline as website inquiries.</p></div>
        <span className="workspace-live-chip"><BriefcaseBusiness size={14} /> New opportunity</span>
      </div>
      {previewMode ? <ConfigurationState service="Local preview" copy="The complete intake flow is available for review, but CRM writes require an authenticated production session." /> : null}
      {isAdmin ? <div className="lead-permission-note"><ShieldCheck size={17} /><div><strong>Administrator intake</strong><span>You can choose the salesperson who will own this lead.</span></div></div> : <div className="lead-permission-note"><UserRoundCheck size={17} /><div><strong>Sales intake</strong><span>New leads are assigned to you unless the email already belongs to another active salesperson.</span></div></div>}
      {message ? <p className="record-action-message" role="status">{message}</p> : null}
      {error ? <p className="lead-form-alert error" role="alert">{error}</p> : null}
      <form className="workspace-card lead-create-form" onSubmit={createLead} noValidate>
        <div className="workspace-card-heading"><div><span>LEAD / REQUIRED DETAILS</span><h3>Customer and project information</h3></div><BriefcaseBusiness size={20} /></div>
        <LeadFormFields
          values={form}
          errors={errors}
          salespeople={salespeople}
          showAssignment={isAdmin}
          disabled={busy}
          onChange={update}
        />
        <div className="lead-form-actions"><span>{isAdmin ? 'Admin may edit, reassign, and convert after creation.' : 'An administrator controls later record edits and conversion.'}</span><button className="portal-primary-button" disabled={busy} type="submit"><Save size={15} /> {busy ? 'Creating lead…' : 'Create lead'}</button></div>
      </form>
    </section>
  )
}
