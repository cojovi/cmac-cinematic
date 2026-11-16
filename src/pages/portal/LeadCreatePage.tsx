import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, BriefcaseBusiness, Save, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LeadFormFields } from '../../components/portal/LeadFormFields'
import { PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { useCrmRows } from '../../hooks/useCrmRows'
import { useAction, useActor } from '../../hooks/useCrm'
import { useToast } from '../../hooks/useToast'
import { createLead } from '../../lib/crm/api'
import { emptyLeadForm, leadAssigneeOptions, leadErrors, leadFormSchema, type LeadFormValues, type LeadFieldErrors } from '../../lib/lead-management'

/** Another screen (a customer record, a QR inquiry) can hand over what it already knows through router state — never the URL, so contact details stay out of history and logs. */
export interface LeadPrefill { prefill?: Partial<LeadFormValues>; origin?: string }

export default function LeadCreatePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const actor = useActor()
  const toast = useToast()
  const { run, busy } = useAction()
  const handoff = (location.state ?? {}) as LeadPrefill
  const employees = useCrmRows('employees', { orderBy: 'display_name', ascending: true, limit: 500 })
  const [form, setForm] = useState<LeadFormValues>(() => ({
    ...emptyLeadForm,
    ...handoff.prefill,
    assigned_employee_id: actor.isAdmin ? handoff.prefill?.assigned_employee_id ?? '' : actor.id,
  }))
  const [errors, setErrors] = useState<LeadFieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const assignees = useMemo(() => leadAssigneeOptions(employees.rows), [employees.rows])

  function update<Key extends keyof LeadFormValues>(field: Key, value: LeadFormValues[Key]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const parsed = leadFormSchema.safeParse({ ...form, status: 'new', assigned_employee_id: actor.isAdmin ? form.assigned_employee_id : actor.id })
    if (!parsed.success) {
      setErrors(leadErrors(parsed.error))
      setError('Review the highlighted fields before saving this lead.')
      return
    }
    await run(async () => {
      const result = await createLead(actor, parsed.data)
      if (!actor.isAdmin && result.ownerId && result.ownerId !== actor.id) {
        // The record exists but RLS hides it from this representative, so do not navigate into a "not found".
        toast.success('Lead recorded and routed to the customer’s existing owner. It is outside your queue.')
        navigate('/employee-portal/leads', { replace: true })
        return
      }
      toast.success('Lead created.')
      navigate(`/employee-portal/leads/${result.leadId}`, { replace: true })
    })
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
      {handoff.origin ? <div className="lead-permission-note"><ShieldCheck size={17} /><div><strong>Started from {handoff.origin}</strong><span>The details below were carried over. Review them, fill in anything missing, then create the lead.</span></div></div> : null}
      {actor.isAdmin ? <div className="lead-permission-note"><ShieldCheck size={17} /><div><strong>Administrator intake</strong><span>Assign this lead to any active salesperson or administrator. Automatic round-robin selects salespeople only.</span></div></div> : <div className="lead-permission-note"><UserRoundCheck size={17} /><div><strong>Sales intake</strong><span>New leads are assigned to you unless the email already belongs to another active employee.</span></div></div>}
      {error ? <p className="lead-form-alert error" role="alert">{error}</p> : null}
      <form className="workspace-card lead-create-form" onSubmit={submit} noValidate>
        <div className="workspace-card-heading"><div><span>LEAD / REQUIRED DETAILS</span><h3>Customer and project information</h3></div><BriefcaseBusiness size={20} /></div>
        <LeadFormFields values={form} errors={errors} assignees={assignees} showAssignment={actor.isAdmin} disabled={busy} onChange={update} />
        <div className="lead-form-actions"><span>{actor.isAdmin ? 'You can edit and reassign after creation.' : 'After creation you can move it through the pipeline, log activity, and convert it to a deal.'}</span><button className="portal-primary-button" disabled={busy} type="submit"><Save size={15} /> {busy ? 'Creating lead…' : 'Create lead'}</button></div>
      </form>
    </section>
  )
}
