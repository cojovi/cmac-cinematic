import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FileSignature, Home, ReceiptText, Save, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { usePortalRows } from '../../hooks/usePortalRows'
import { mockInventoryProvider, type InventoryUnit } from '../../lib/inventory-provider'
import { supabase } from '../../lib/supabase'
import { ComingSoonBanner, ConfigurationState, PortalError } from '../../components/portal/AsyncState'

interface BuyerDraft { firstName: string; lastName: string; email: string; phone: string; company: string; projectAddress: string }
const emptyBuyer: BuyerDraft = { firstName: '', lastName: '', email: '', phone: '', company: '', projectAddress: '' }
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const steps = ['Select model', 'Customer & site', 'Transaction template', 'Review & save']

export default function NewSalePage() {
  const [searchParams] = useSearchParams()
  const { employee, previewMode } = useAuth()
  const contacts = usePortalRows('contacts', { orderBy: 'updated_at', limit: 250 })
  const templates = usePortalRows('document_templates', { orderBy: 'display_order', ascending: true, limit: 100 })
  const [units, setUnits] = useState<InventoryUnit[]>([])
  const [step, setStep] = useState(1)
  const [unitId, setUnitId] = useState(searchParams.get('model') ?? 'MODEL-LIVING-40')
  const [contactId, setContactId] = useState('new')
  const [buyer, setBuyer] = useState(emptyBuyer)
  const [templateId, setTemplateId] = useState('')
  const [depositPercent, setDepositPercent] = useState(10)
  const [deliveryAmount, setDeliveryAmount] = useState(0)
  const [dealId, setDealId] = useState<string | null>(null)
  const [dealNumber, setDealNumber] = useState<string | null>(null)
  const [realUnitId, setRealUnitId] = useState('')
  const [realProductType, setRealProductType] = useState('Mini Home')
  const [unitConfirmed, setUnitConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void mockInventoryProvider.getUnits().then(setUnits) }, [])
  const unit = units.find((item) => item.id === unitId) ?? units[0]
  const selectedContact = contacts.rows.find((row) => String(row.id) === contactId)
  const selectedTemplate = templates.rows.find((row) => String(row.id) === templateId)
  const contactReady = contactId !== 'new' || Boolean(buyer.firstName && buyer.email && buyer.phone && buyer.projectAddress)
  const total = (unit?.price ?? 0) + deliveryAmount
  const completion = useMemo(() => Math.round(([Boolean(unit), contactReady, Boolean(templateId), Boolean(dealId)].filter(Boolean).length / 4) * 100), [contactReady, dealId, templateId, unit])

  function next(event?: FormEvent) { event?.preventDefault(); setStep((value) => Math.min(4, value + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function back() { setStep((value) => Math.max(1, value - 1)) }

  async function ensureContact() {
    if (contactId !== 'new') return contactId
    if (!supabase || !employee) throw new Error('CRM is not configured.')
    const { data, error: contactError } = await supabase.from('contacts').insert({
      first_name: buyer.firstName.trim(), last_name: buyer.lastName.trim(), display_name: `${buyer.firstName} ${buyer.lastName}`.trim(),
      email: buyer.email.trim().toLowerCase(), phone: buyer.phone.trim(), company: buyer.company.trim() || null,
      project_address: buyer.projectAddress.trim(), assigned_employee_id: employee.id, created_by: employee.id,
    }).select('id').single()
    if (contactError) throw contactError
    setContactId(String(data.id))
    await contacts.reload()
    return String(data.id)
  }

  async function saveDraft() {
    if (!unit || !contactReady) { setError('Select a model and complete the required customer fields before saving.'); return null }
    if (previewMode) { setMessage('Local preview only — the draft was not saved.'); return null }
    if (!supabase || !employee) { setError('Supabase is not configured.'); return null }
    setBusy(true); setError(null); setMessage(null)
    try {
      const savedContactId = await ensureContact()
      let savedDealId = dealId
      let savedDealNumber = dealNumber
      if (dealId) {
        const { error: updateError } = await supabase.from('deals').update({ contact_id: savedContactId, base_amount: unit.price, delivery_amount: deliveryAmount, deposit_percent: depositPercent, project_address: buyer.projectAddress || selectedContact?.project_address || null }).eq('id', dealId)
        if (updateError) throw updateError
      } else {
        const { data, error: dealError } = await supabase.from('deals').insert({ contact_id: savedContactId, sales_rep_id: employee.id, base_amount: unit.price, delivery_amount: deliveryAmount, deposit_percent: depositPercent, project_address: buyer.projectAddress || selectedContact?.project_address || null, project_name: `${selectedContact?.display_name ?? `${buyer.firstName} ${buyer.lastName}`.trim()} — ${unit.name}` }).select('id,deal_number').single()
        if (dealError) throw dealError
        savedDealId = String(data.id); savedDealNumber = String(data.deal_number); setDealId(savedDealId); setDealNumber(savedDealNumber)
      }
      if (!savedDealId) throw new Error('Deal draft was not created.')
      const unitPayload = { deal_id: savedDealId, external_unit_id: unitConfirmed ? realUnitId.trim() : unit.id, external_product_type: unitConfirmed ? realProductType.trim() : unit.name, source: unitConfirmed ? 'manual' : 'mock', confirmed_by: unitConfirmed ? employee.id : null, confirmed_at: unitConfirmed ? new Date().toISOString() : null }
      let unitError: { message: string } | null = null
      if (unitConfirmed) {
        const { data: mockReference } = await supabase.from('deal_units').select('id').eq('deal_id', savedDealId).eq('source', 'mock').limit(1).maybeSingle()
        if (mockReference) {
          const updateResult = await supabase.from('deal_units').update(unitPayload).eq('id', mockReference.id)
          unitError = updateResult.error
        } else {
          const upsertResult = await supabase.from('deal_units').upsert(unitPayload, { onConflict: 'deal_id,external_unit_id' })
          unitError = upsertResult.error
        }
      } else {
        const upsertResult = await supabase.from('deal_units').upsert(unitPayload, { onConflict: 'deal_id,external_unit_id' })
        unitError = upsertResult.error
      }
      if (unitError) throw unitError
      setMessage(`Draft ${savedDealNumber ?? 'deal'} saved securely.`)
      return { dealId: savedDealId, contactId: savedContactId }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The deal draft could not be saved.')
      return null
    } finally { setBusy(false) }
  }

  async function createQuote() {
    const saved = dealId && contactId !== 'new' ? { dealId, contactId } : await saveDraft()
    if (!saved || previewMode || !supabase || !employee) return
    setBusy(true); setError(null)
    const { data, error: quoteError } = await supabase.from('quotes').insert({ contact_id: saved.contactId, deal_id: saved.dealId, employee_id: employee.id, subtotal: unit.price, delivery_amount: deliveryAmount, status: 'draft' }).select('id,quote_number').single()
    const itemResult = !quoteError && data
      ? await supabase.from('quote_items').insert({ quote_id: data.id, description: `${unit.name} base configuration`, quantity: 1, unit_price: unit.price })
      : null
    setBusy(false)
    if (quoteError) setError(quoteError.message)
    else if (itemResult?.error) setError(`Quote ${String(data.quote_number)} was created, but its line item failed: ${itemResult.error.message}`)
    else setMessage(`Quote ${String(data.quote_number)} created as a portal record. No PDF or email was generated.`)
  }

  async function prepareContract() {
    setError(null)
    setMessage('DocuSign contract preparation is coming soon. No envelope was created or sent.')
  }

  if (contacts.error || templates.error) return <PortalError message={contacts.error ?? templates.error ?? 'Unable to load sale data.'} />
  return <section className="new-sale-page" aria-labelledby="new-sale-heading">
    <div className="workspace-view-heading"><div><span>DRAFT / PERSISTENT TRANSACTION</span><h2 id="new-sale-heading">Build a clean, verifiable sale</h2><p>Model references are safe for planning. Legal and sold states require a confirmed real unit identity.</p></div><div className="sale-save-cluster"><span>{completion}% complete</span><button className="portal-secondary-button" disabled={busy || !contactReady} type="button" onClick={() => void saveDraft()}><Save size={15} /> Save draft</button></div></div>
    {previewMode ? <ConfigurationState service="Local preview" copy="Wizard navigation works, but database writes and provider actions are intentionally disabled." /> : null}
    {step >= 3 ? <ComingSoonBanner title="Contract signing will arrive in a later iteration" copy="You can continue saving deals and creating quote records. DocuSign envelope creation and signing are intentionally disabled for now." /> : null}
    {message ? <p className="record-action-message" role="status">{message}</p> : null}
    {error ? <PortalError message={error} /> : null}
    <ol className="portal-stepper">{steps.map((label, index) => <li key={label} className={step === index + 1 ? 'current' : step > index + 1 ? 'complete' : ''}><button type="button" disabled={index + 1 > step} onClick={() => setStep(index + 1)}><span>{step > index + 1 ? <Check size={14} /> : index + 1}</span>{label}</button></li>)}</ol>
    <div className="portal-content-grid"><div className="portal-panel">
      {step === 1 ? <><div className="portal-panel-heading"><div><span>STEP 01 / MODEL PROVIDER</span><h2>Select a model reference</h2><p>These cards do not represent individual live units.</p></div><span className="panel-count">Source / mock</span></div><div className="unit-picker">{units.map((item) => <button key={item.id} className={unitId === item.id ? 'unit-card selected' : 'unit-card'} type="button" onClick={() => setUnitId(item.id)}><div className="unit-image"><img src={item.image} alt={item.imageAlt} /><span>{item.status}</span></div><div className="unit-card-body"><div className="unit-id"><Home size={15} /> {item.id}</div><h3>{item.name}</h3><p>{item.subtitle}</p><div className="unit-meta"><strong>{money.format(item.price)}</strong><span>{item.leadTime}</span></div></div></button>)}</div><div className="portal-panel-actions"><span>Draft-only model identity</span><button className="portal-primary-button" onClick={() => next()} type="button">Customer details <ArrowRight size={15} /></button></div></> : null}
      {step === 2 ? <form onSubmit={next}><div className="portal-panel-heading"><div><span>STEP 02 / CANONICAL CONTACT</span><h2>Select or create customer</h2><p>Email remains the case-insensitive canonical contact identity.</p></div></div><div className="portal-form-grid"><label className="field-wide">Existing contact<select value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="new">Create a new contact</option>{contacts.rows.map((contact) => <option key={String(contact.id)} value={String(contact.id)}>{String(contact.display_name)} — {String(contact.email)}</option>)}</select></label>{contactId === 'new' ? <><label>First name *<input value={buyer.firstName} onChange={(event) => setBuyer((current) => ({ ...current, firstName: event.target.value }))} required /></label><label>Last name<input value={buyer.lastName} onChange={(event) => setBuyer((current) => ({ ...current, lastName: event.target.value }))} /></label><label>Email *<input type="email" value={buyer.email} onChange={(event) => setBuyer((current) => ({ ...current, email: event.target.value }))} required /></label><label>Phone *<input value={buyer.phone} onChange={(event) => setBuyer((current) => ({ ...current, phone: event.target.value }))} required /></label><label>Company<input value={buyer.company} onChange={(event) => setBuyer((current) => ({ ...current, company: event.target.value }))} /></label><label className="field-wide">Project / delivery address *<input value={buyer.projectAddress} onChange={(event) => setBuyer((current) => ({ ...current, projectAddress: event.target.value }))} required /></label></> : null}</div><div className="portal-panel-actions"><button className="portal-text-button" type="button" onClick={back}><ArrowLeft size={15} /> Back</button><button className="portal-primary-button" type="submit">Choose template <ArrowRight size={15} /></button></div></form> : null}
      {step === 3 ? <><div className="portal-panel-heading"><div><span>STEP 03 / LEGAL METADATA</span><h2>Transaction template</h2><p>Review placeholder metadata now; provider mapping and envelope creation are deferred.</p></div></div><div className="document-list">{templates.rows.map((template) => <label key={String(template.id)} className={templateId === template.id ? 'document-row selected' : 'document-row'}><input type="radio" checked={templateId === template.id} onChange={() => setTemplateId(String(template.id))} /><span className="document-check">{templateId === template.id ? <Check size={14} /> : null}</span><FileSignature size={20} /><span className="document-copy"><strong>{String(template.title)}</strong><small>{String(template.description ?? '')}</small></span><span className={`document-group ${template.is_active ? 'group-required' : ''}`}>{template.is_active ? 'Active' : 'Placeholder'}</span></label>)}</div><div className="real-unit-confirmation"><ShieldCheck size={20} /><div><h3>Replace model reference before a future legal send</h3><p>Enter a verified operational unit ID supplied by authorized CMAC staff. The Bolt per-unit feed remains a later upgrade.</p><div><label>Real unit / job ID<input value={realUnitId} onChange={(event) => { setRealUnitId(event.target.value); setUnitConfirmed(false) }} /></label><label>Product type<input value={realProductType} onChange={(event) => { setRealProductType(event.target.value); setUnitConfirmed(false) }} /></label><button className="portal-secondary-button" type="button" disabled={!realUnitId.trim() || !realProductType.trim()} onClick={() => setUnitConfirmed(true)}>{unitConfirmed ? <Check size={15} /> : <ShieldCheck size={15} />} {unitConfirmed ? 'Confirmed for draft' : 'Confirm identity'}</button></div></div></div><div className="portal-panel-actions"><button className="portal-text-button" type="button" onClick={back}><ArrowLeft size={15} /> Back</button><button className="portal-primary-button" disabled={!templateId} onClick={() => next()} type="button">Review transaction <ArrowRight size={15} /></button></div></> : null}
      {step === 4 ? <><div className="portal-panel-heading"><div><span>STEP 04 / REVIEW</span><h2>Save the transaction</h2><p>Quote records are available now. Contract delivery remains clearly deferred and never simulates success.</p></div><span className="panel-count">{dealNumber ?? 'Unsaved draft'}</span></div><div className="sale-review-grid"><article><UserRound size={18} /><span>Customer</span><strong>{String(selectedContact?.display_name ?? `${buyer.firstName} ${buyer.lastName}`.trim())}</strong><small>{String(selectedContact?.email ?? buyer.email)}</small></article><article><Home size={18} /><span>Unit reference</span><strong>{unitConfirmed ? realUnitId : unit?.id}</strong><small>{unitConfirmed ? 'Manual / confirmed' : 'Mock / draft only'}</small></article><article><ReceiptText size={18} /><span>Transaction value</span><strong>{money.format(total)}</strong><small>{depositPercent}% deposit · {money.format(total * depositPercent / 100)}</small></article><article><FileSignature size={18} /><span>Template</span><strong>{String(selectedTemplate?.title ?? 'Not selected')}</strong><small>DocuSign / coming soon</small></article></div><div className="portal-panel-actions review-actions"><button className="portal-text-button" type="button" onClick={back}><ArrowLeft size={15} /> Back</button><div><button className="portal-secondary-button" disabled={busy} type="button" onClick={() => void createQuote()}><ReceiptText size={15} /> Create quote</button><button className="portal-primary-button coming-soon-action" disabled={busy} type="button" onClick={() => void prepareContract()}><FileSignature size={15} /> Contract signing · coming soon</button></div></div></> : null}
    </div><aside className="deal-summary"><div className="deal-summary-top"><div><span>TRANSACTION DRAFT</span><strong>{dealNumber ?? 'NOT SAVED'}</strong></div><span className="summary-progress">{completion}%</span></div><div className="summary-progress-bar"><span style={{ width: `${completion}%` }} /></div>{unit ? <div className="summary-unit"><img src={unit.image} alt="" /><div><span>{unit.id}</span><strong>{unit.name}</strong><small>{unit.subtitle}</small></div></div> : null}<dl className="summary-data"><div><dt>Base price</dt><dd>{money.format(unit?.price ?? 0)}</dd></div><div><dt>Delivery</dt><dd>{money.format(deliveryAmount)}</dd></div><div><dt>Deposit</dt><dd>{depositPercent}%</dd></div><div><dt>Unit state</dt><dd>{unitConfirmed ? 'Confirmed manual' : 'Mock draft'}</dd></div></dl><div className="summary-controls"><label>Deposit<select value={depositPercent} onChange={(event) => setDepositPercent(Number(event.target.value))}><option value={10}>10%</option><option value={20}>20%</option><option value={25}>25%</option></select></label><label>Delivery amount<input type="number" min="0" value={deliveryAmount} onChange={(event) => setDeliveryAmount(Number(event.target.value))} /></label></div></aside></div>
  </section>
}
