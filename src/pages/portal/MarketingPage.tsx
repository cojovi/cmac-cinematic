import { useMemo, useState, type FormEvent } from 'react'
import { Check, FileImage, Mail, Paperclip, Send, ShieldCheck } from 'lucide-react'
import { usePortalRows } from '../../hooks/usePortalRows'
import { useAuth } from '../../auth/useAuth'
import { supabase } from '../../lib/supabase'
import { ConfigurationState, PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'

const attachmentCeiling = 18 * 1024 * 1024
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export default function MarketingPage() {
  const { previewMode } = useAuth()
  const contacts = usePortalRows('contacts', { orderBy: 'updated_at', limit: 250 })
  const materials = usePortalRows('marketing_materials', { orderBy: 'display_order', ascending: true, limit: 100 })
  const [contactId, setContactId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [subject, setSubject] = useState('Explore CMAC Container Homes')
  const [body, setBody] = useState('Thank you for your interest in CMAC Container Homes. I selected a few approved resources for your review.')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeMaterials = materials.rows.filter((item) => item.is_active)
  const totalSize = useMemo(() => activeMaterials.filter((item) => selected.includes(String(item.id))).reduce((sum, item) => sum + Number(item.file_size ?? 0), 0), [activeMaterials, selected])

  async function send(event: FormEvent) {
    event.preventDefault(); setError(null); setMessage(null)
    if (previewMode || !supabase) { setMessage('Local preview only — no message was sent.'); return }
    if (totalSize > attachmentCeiling) { setError('Attachments exceed the 18 MB pre-encoding limit.'); return }
    setBusy(true)
    const { data, error: functionError } = await supabase.functions.invoke('send-marketing-email', { body: { contact_id: contactId, material_ids: selected, subject, body } })
    setBusy(false)
    if (functionError) setError(functionError.message)
    else setMessage(String((data as { message?: string })?.message ?? 'Gmail accepted the message.'))
  }

  if (contacts.loading || materials.loading) return <PortalLoading label="Loading approved outreach materials" />
  if (contacts.error || materials.error) return <PortalError message={contacts.error ?? materials.error ?? 'Marketing data is unavailable.'} />
  return <section className="portal-library-view" aria-labelledby="marketing-heading">
    <div className="workspace-view-heading"><div><span>OUTREACH / APPROVED ATTACHMENTS</span><h2 id="marketing-heading">Send from your CMAC Gmail</h2><p>Select only active, admin-approved materials. Sender identity always comes from your verified employee session.</p></div><span className="workspace-live-chip"><ShieldCheck size={14} /> {activeMaterials.length} active files</span></div>
    {previewMode ? <ConfigurationState service="Gmail delegation" copy="Provider calls are disabled in local preview. Production reports not configured until Workspace delegation secrets are present." /> : null}
    {message ? <p className="record-action-message" role="status">{message}</p> : null}{error ? <PortalError message={error} /> : null}
    <form className="marketing-compose" onSubmit={send}>
      <article className="workspace-card compose-fields"><div className="workspace-card-heading"><div><span>MESSAGE / GMAIL</span><h3>Customer message</h3></div><Mail size={20} /></div><label><span>Recipient contact</span><select value={contactId} onChange={(event) => setContactId(event.target.value)} required><option value="">Select a contact</option>{contacts.rows.map((contact) => <option key={String(contact.id)} value={String(contact.id)}>{String(contact.display_name)} — {String(contact.email)}</option>)}</select></label><label><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} required /></label><label><span>Message</span><textarea rows={10} value={body} onChange={(event) => setBody(event.target.value)} required /></label><div className="compose-send-row"><span><Paperclip size={14} /> {selected.length} files · {mb(totalSize)} / 18 MB</span><button className="portal-primary-button" disabled={busy || previewMode || selected.length === 0} type="submit"><Send size={15} /> {busy ? 'Sending…' : 'Send approved email'}</button></div></article>
      <article className="workspace-card material-picker"><div className="workspace-card-heading"><div><span>LIBRARY / ACTIVE ONLY</span><h3>Approved materials</h3></div><FileImage size={20} /></div>{activeMaterials.length === 0 ? <PortalEmpty title="No approved materials" copy="Production begins empty. An administrator must upload, review, and activate the first file." /> : activeMaterials.map((item) => { const checked = selected.includes(String(item.id)); return <label key={String(item.id)} className={checked ? 'material-select-row selected' : 'material-select-row'}><input type="checkbox" checked={checked} onChange={() => setSelected((current) => checked ? current.filter((id) => id !== item.id) : [...current, String(item.id)])} /><span>{checked ? <Check size={14} /> : null}</span><div><strong>{String(item.title)}</strong><small>{String(item.category)} · {mb(Number(item.file_size))}</small></div></label> })}</article>
    </form>
  </section>
}
