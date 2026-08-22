import { useState, type FormEvent } from 'react'
import { FileUp, Library, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { usePortalRows } from '../../hooks/usePortalRows'
import { supabase } from '../../lib/supabase'
import { ConfigurationState, PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'

const maxFileSize = 18 * 1024 * 1024

export default function MarketingAdminPage() {
  const { employee, previewMode } = useAuth()
  const materials = usePortalRows('marketing_materials', { orderBy: 'display_order', ascending: true, limit: 100 })
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function upload(event: FormEvent) {
    event.preventDefault(); setError(null); setMessage(null)
    if (!file || !employee) return
    if (file.size > maxFileSize) { setError('File exceeds the 18 MB pre-encoding attachment ceiling.'); return }
    if (previewMode || !supabase) { setMessage('Local preview only — no file was uploaded.'); return }
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`
    const storagePath = `${category}/${slug}/${file.name}`
    const { error: uploadError } = await supabase.storage.from('marketing-materials').upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadError) { setError(uploadError.message); return }
    const { error: insertError } = await supabase.from('marketing_materials').insert({ title, slug, category, storage_path: storagePath, file_name: file.name, mime_type: file.type || 'application/octet-stream', file_size: file.size, is_active: false, created_by: employee.id })
    if (insertError) setError(insertError.message); else { setMessage('File uploaded privately as inactive. Review it before activation.'); setTitle(''); setFile(null); await materials.reload() }
  }

  async function toggleActive(id: string, active: boolean, name: string) {
    if (previewMode || !supabase) return
    if (!window.confirm(`${active ? 'Deactivate' : 'Activate'} “${name}” for sales outreach?`)) return
    const { error: updateError } = await supabase.from('marketing_materials').update({ is_active: !active }).eq('id', id)
    if (updateError) setError(updateError.message); else await materials.reload()
  }

  if (materials.loading) return <PortalLoading label="Loading private marketing library" />
  if (materials.error) return <PortalError message={materials.error} />
  return <section className="portal-library-view" aria-labelledby="marketing-admin-heading"><div className="workspace-view-heading"><div><span>ADMIN / PRIVATE STORAGE</span><h2 id="marketing-admin-heading">Approved material library</h2><p>Production begins empty. Uploads are private and inactive until an administrator explicitly approves them.</p></div><span className="workspace-live-chip"><Library size={14} /> {materials.rows.length} files</span></div>{previewMode ? <ConfigurationState service="Private Storage" copy="Uploads and approvals require a configured Supabase project and authenticated admin." /> : null}{message ? <p className="record-action-message">{message}</p> : null}{error ? <PortalError message={error} /> : null}<div className="admin-grid"><form className="workspace-card record-action-form" onSubmit={upload}><div className="workspace-card-heading"><div><span>LIBRARY / UPLOAD</span><h3>Add controlled material</h3></div><FileUp size={20} /></div><label><span>Display title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="general">General</option><option value="residential">Residential</option><option value="workforce">Workforce</option><option value="commercial">Commercial</option><option value="technical">Technical</option><option value="delivery">Delivery</option><option value="warranty">Warranty</option><option value="other">Other</option></select></label><label><span>File · max 18 MB</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label><button className="portal-primary-button" disabled={previewMode} type="submit"><ShieldCheck size={15} /> Upload privately</button></form><div className="material-admin-list">{materials.rows.length === 0 ? <PortalEmpty title="Library intentionally empty" copy="Existing repository media is not automatically approved for customer outreach." /> : materials.rows.map((item) => <article key={String(item.id)}><div><small>{String(item.category).toUpperCase()}</small><strong>{String(item.title)}</strong><span>{String(item.file_name)} · {(Number(item.file_size) / 1024 / 1024).toFixed(1)} MB</span></div><span className={`status-pill ${item.is_active ? 'status-completed' : 'status-draft'}`}>{item.is_active ? 'Active' : 'Inactive'}</span><button className="portal-secondary-button" disabled={previewMode} type="button" onClick={() => void toggleActive(String(item.id), Boolean(item.is_active), String(item.title))}>{item.is_active ? 'Deactivate' : 'Activate'}</button></article>)}</div></div></section>
}
