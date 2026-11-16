import type { ReactNode } from 'react'
import { Copy, Flame, Inbox, Mail, MessageSquare, Phone, Snowflake, Thermometer } from 'lucide-react'
import { dealStage, initials, leadStage, smsHref, telHref, type LeadHeat, type Tone } from '../../lib/crm/pipeline'
import { useToast } from '../../hooks/useToast'
import type { JsonRecord } from '../../lib/database.types'

export function Badge({ tone = 'neutral', children, plain = false }: { tone?: Tone; children: ReactNode; plain?: boolean }) {
  return <span className={`crm-badge tone-${tone}${plain ? ' plain' : ''}`}>{children}</span>
}

export function LeadStageBadge({ status }: { status: unknown }) {
  const stage = leadStage(status)
  return <Badge tone={stage.tone}>{stage.label}</Badge>
}

export function DealStageBadge({ stage, status }: { stage: unknown; status?: unknown }) {
  const def = dealStage(stage)
  if (status === 'on_hold') return <Badge tone="warn">{def.label} · On hold</Badge>
  if (status === 'cancelled') return <Badge tone="muted">Cancelled</Badge>
  return <Badge tone={def.tone}>{def.label}</Badge>
}

const statusTones: Record<string, Tone> = {
  draft: 'neutral', sent: 'info', accepted: 'good', declined: 'bad', expired: 'muted', cancelled: 'muted',
  lead: 'info', prospect: 'progress', customer: 'good', inactive: 'muted',
}

export function StatusBadge({ value }: { value: unknown }) {
  const text = String(value ?? 'unknown')
  return <Badge tone={statusTones[text] ?? 'neutral'}>{text.charAt(0).toUpperCase() + text.slice(1).replaceAll('_', ' ')}</Badge>
}

export function HeatBadge({ heat }: { heat: LeadHeat }) {
  const Icon = heat.level === 'hot' ? Flame : heat.level === 'warm' ? Thermometer : Snowflake
  const label = heat.level === 'hot' ? 'Hot' : heat.level === 'warm' ? 'Warm' : 'Cool'
  return <span className={`crm-heat ${heat.level}`} title={heat.reasons.length ? `${label} — ${heat.reasons.join(', ')}` : `${label} — based on timing, stage, and recency`}><Icon size={13} aria-hidden="true" />{label}</span>
}

function related(row: JsonRecord, key: string) {
  const value = row[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

/** Owner chip. Never prints an internal id: a hidden join reads as "Unavailable". */
export function Owner({ row, idField = 'assigned_employee_id', compact = false }: { row: JsonRecord; idField?: string; compact?: boolean }) {
  const person = related(row, 'owner')
  const name = person?.display_name ? String(person.display_name) : row[idField] ? 'Unavailable' : 'Unassigned'
  const unassigned = !row[idField]
  return (
    <span className="crm-owner" title={`Owner: ${name}`}>
      <span className={unassigned ? 'crm-avatar unassigned' : 'crm-avatar'} aria-hidden="true">{unassigned ? '?' : initials(name)}</span>
      {compact ? <span className="sr-only">{name}</span> : <span>{name}</span>}
    </span>
  )
}

/** One-tap call / text / email / copy for the person on a record. */
export function ContactActions({ name, phone, email, size = 15 }: { name: string; phone: unknown; email: unknown; size?: number }) {
  const toast = useToast()
  const tel = telHref(phone)
  const sms = smsHref(phone)
  const mail = email ? `mailto:${String(email)}` : null
  async function copy() {
    const text = [phone, email].filter(Boolean).join(' · ')
    try { await navigator.clipboard.writeText(text); toast.success('Contact details copied.') }
    catch { toast.error('Copy is not available in this browser.') }
  }
  return (
    <>
      {tel ? <a className="crm-icon-btn" href={tel} aria-label={`Call ${name}`} title={`Call ${String(phone)}`}><Phone size={size} /></a> : null}
      {sms ? <a className="crm-icon-btn" href={sms} aria-label={`Text ${name}`} title={`Text ${String(phone)}`}><MessageSquare size={size} /></a> : null}
      {mail ? <a className="crm-icon-btn" href={mail} aria-label={`Email ${name}`} title={`Email ${String(email)}`}><Mail size={size} /></a> : null}
      {phone || email ? <button className="crm-icon-btn" type="button" onClick={() => void copy()} aria-label={`Copy contact details for ${name}`} title="Copy phone and email"><Copy size={size} /></button> : null}
    </>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="crm-empty"><Inbox size={22} aria-hidden="true" /><strong>{title}</strong>{children ? <span>{children}</span> : null}</div>
}

export function Segmented<Value extends string>({ label, value, options, onChange }: {
  label: string; value: Value; options: { value: Value; label: string; icon?: ReactNode }[]; onChange: (value: Value) => void
}) {
  return (
    <div className="crm-seg" role="group" aria-label={label}>
      {options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.icon}{option.label}</button>)}
    </div>
  )
}

export function SelectFilter({ label, value, onChange, children, disabled }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean }) {
  return <label className="crm-select"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{children}</select></label>
}

export interface BarDatum { label: string; value: number; note?: string }

/** Horizontal magnitude bars: one hue, value at the tip in text ink, native tooltip per row. */
export function BarList({ data, format = String, emptyLabel = 'No data yet' }: { data: BarDatum[]; format?: (value: number) => string; emptyLabel?: string }) {
  const max = Math.max(1, ...data.map((item) => item.value))
  if (!data.length) return <Empty title={emptyLabel} />
  return (
    <ul className="crm-bars">
      {data.map((item) => (
        <li key={item.label} title={`${item.label}: ${format(item.value)}${item.note ? ` (${item.note})` : ''}`}>
          <span className="label">{item.label}</span>
          <span className="track"><span className="fill" style={{ width: `${(item.value / max) * 100}%`, display: item.value > 0 ? 'block' : 'none' }} /></span>
          <span className="value">{format(item.value)}{item.note ? <small>{item.note}</small> : null}</span>
        </li>
      ))}
    </ul>
  )
}
