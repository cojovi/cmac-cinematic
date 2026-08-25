import { leadProjectTypes, leadSources, leadStatuses, leadTimings, type LeadFieldErrors, type LeadFormValues } from '../../lib/lead-management'

export interface SalespersonOption {
  id: string
  displayName: string
  repCode: string
}

interface LeadFormFieldsProps {
  values: LeadFormValues
  errors: LeadFieldErrors
  salespeople: SalespersonOption[]
  showStatus?: boolean
  showAssignment?: boolean
  disabled?: boolean
  onChange: <Key extends keyof LeadFormValues>(field: Key, value: LeadFormValues[Key]) => void
}

function errorId(field: keyof LeadFormValues) {
  return `lead-${field}-error`
}

export function LeadFormFields({
  values,
  errors,
  salespeople,
  showStatus = false,
  showAssignment = false,
  disabled = false,
  onChange,
}: LeadFormFieldsProps) {
  const fieldProps = (field: keyof LeadFormValues) => ({
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? errorId(field) : undefined,
  })
  const errorFor = (field: keyof LeadFormValues) => errors[field]
    ? <small className="portal-field-error" id={errorId(field)}>{errors[field]}</small>
    : null

  return (
    <div className="lead-form-grid">
      <label>
        <span>First name *</span>
        <input {...fieldProps('first_name')} disabled={disabled} value={values.first_name} onChange={(event) => onChange('first_name', event.target.value)} autoComplete="given-name" />
        {errorFor('first_name')}
      </label>
      <label>
        <span>Last name</span>
        <input {...fieldProps('last_name')} disabled={disabled} value={values.last_name} onChange={(event) => onChange('last_name', event.target.value)} autoComplete="family-name" />
        {errorFor('last_name')}
      </label>
      <label>
        <span>Email *</span>
        <input {...fieldProps('email')} disabled={disabled} type="email" value={values.email} onChange={(event) => onChange('email', event.target.value)} autoComplete="email" />
        {errorFor('email')}
      </label>
      <label>
        <span>Phone *</span>
        <input {...fieldProps('phone')} disabled={disabled} type="tel" inputMode="tel" value={values.phone} onChange={(event) => onChange('phone', event.target.value)} autoComplete="tel" />
        {errorFor('phone')}
      </label>
      <label>
        <span>Lead source *</span>
        <select {...fieldProps('source')} disabled={disabled} value={values.source} onChange={(event) => onChange('source', event.target.value as LeadFormValues['source'])}>
          {leadSources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
        </select>
        {errorFor('source')}
      </label>
      {showStatus ? <label>
        <span>Pipeline status *</span>
        <select {...fieldProps('status')} disabled={disabled} value={values.status} onChange={(event) => onChange('status', event.target.value as LeadFormValues['status'])}>
          {leadStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
        {errorFor('status')}
      </label> : null}
      {showAssignment ? <label className={showStatus ? '' : 'field-wide'}>
        <span>Assigned salesperson</span>
        <select {...fieldProps('assigned_employee_id')} disabled={disabled} value={values.assigned_employee_id} onChange={(event) => onChange('assigned_employee_id', event.target.value)}>
          <option value="">Automatic round-robin</option>
          {salespeople.map((salesperson) => <option key={salesperson.id} value={salesperson.id}>{salesperson.displayName} · {salesperson.repCode}</option>)}
        </select>
        {errorFor('assigned_employee_id')}
      </label> : null}
      <label>
        <span>Project type *</span>
        <select {...fieldProps('project_type')} disabled={disabled} value={values.project_type} onChange={(event) => onChange('project_type', event.target.value)}>
          <option value="">Select a use</option>
          {leadProjectTypes.map((projectType) => <option key={projectType}>{projectType}</option>)}
        </select>
        {errorFor('project_type')}
      </label>
      <label>
        <span>Ideal timing *</span>
        <select {...fieldProps('desired_timing')} disabled={disabled} value={values.desired_timing} onChange={(event) => onChange('desired_timing', event.target.value)}>
          <option value="">Choose timing</option>
          {leadTimings.map((timing) => <option key={timing}>{timing}</option>)}
        </select>
        {errorFor('desired_timing')}
      </label>
      <label className="field-wide">
        <span>Project location *</span>
        <input {...fieldProps('project_location')} disabled={disabled} value={values.project_location} onChange={(event) => onChange('project_location', event.target.value)} placeholder="City, State or project address" autoComplete="street-address" />
        {errorFor('project_location')}
      </label>
      <label className="field-wide">
        <span>Lead summary / notes</span>
        <textarea {...fieldProps('summary')} disabled={disabled} rows={4} value={values.summary} onChange={(event) => onChange('summary', event.target.value)} placeholder="What they need, how they found CMAC, budget context, and the next best step" />
        {errorFor('summary')}
      </label>
      {showStatus && values.status === 'lost' ? <label className="field-wide">
        <span>Lost reason *</span>
        <textarea {...fieldProps('lost_reason')} disabled={disabled} rows={3} value={values.lost_reason} onChange={(event) => onChange('lost_reason', event.target.value)} placeholder="Record why this opportunity was closed" />
        {errorFor('lost_reason')}
      </label> : null}
    </div>
  )
}
