import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Plus, Printer, RotateCcw, Save, Send, Trash2, X } from 'lucide-react'
import { combineQueries, useCrmRows } from '../../hooks/useCrmRows'
import { useAction, useNow } from '../../hooks/useCrm'
import { PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { StatusBadge } from '../../components/crm/primitives'
import { quoteSubtotal, saveQuote, setQuoteStatus, type QuoteLine, type QuoteStatus } from '../../lib/crm/api'
import { contactOf } from '../../lib/crm/links'
import { formatDate, formatMoneyExact, relativeTime, toNumber } from '../../lib/crm/pipeline'
import { related } from '../../lib/team-management'
import type { JsonRecord } from '../../lib/database.types'

const quoteSelect = '*,contacts(display_name,email,phone,company,project_address,billing_address,city,state),deals(id,deal_number,project_name,project_address),owner:employees!quotes_employee_id_fkey(id,display_name,email,phone)'

interface DraftLine { key: number; description: string; quantity: string; unit_price: string }

function QuoteEditor({ quote, items }: { quote: JsonRecord; items: JsonRecord[] }) {
  const now = useNow()
  const { run, busy } = useAction()
  const [lines, setLines] = useState<DraftLine[]>(() => items.map((item, index) => ({ key: index, description: String(item.description ?? ''), quantity: String(toNumber(item.quantity)), unit_price: String(toNumber(item.unit_price)) })))
  const [nextKey, setNextKey] = useState(items.length)
  const [tax, setTax] = useState(String(toNumber(quote.tax)))
  const [delivery, setDelivery] = useState(String(toNumber(quote.delivery_amount)))
  const [notes, setNotes] = useState(String(quote.notes ?? ''))
  const [dirty, setDirty] = useState(false)
  const id = String(quote.id)
  const status = String(quote.status) as QuoteStatus
  const editable = status === 'draft'
  const contact = contactOf(quote)
  const deal = related(quote, 'deals')
  const preparedBy = related(quote, 'owner')
  const parsed: QuoteLine[] = lines.map((line) => ({ description: line.description, quantity: Number(line.quantity), unit_price: Number(line.unit_price) }))
  const subtotal = quoteSubtotal(parsed.filter((line) => line.description.trim()))
  const total = subtotal + toNumber(tax) + toNumber(delivery)

  function patch(key: number, change: Partial<DraftLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...change } : line))
    setDirty(true)
  }
  function addLine() {
    setLines((current) => [...current, { key: nextKey, description: '', quantity: '1', unit_price: '0' }])
    setNextKey((value) => value + 1)
    setDirty(true)
  }
  const save = () => run(() => saveQuote(id, { lines: parsed, tax: Number(tax), deliveryAmount: Number(delivery), notes }), 'Quote saved.').then((ok) => { if (ok) setDirty(false); return ok })
  const setStatus = (next: QuoteStatus, message: string) => void run(async () => {
    // Save pending edits first so the status never applies to numbers the customer was not shown.
    if (dirty && editable) await saveQuote(id, { lines: parsed, tax: Number(tax), deliveryAmount: Number(delivery), notes })
    await setQuoteStatus(id, next)
    setDirty(false)
  }, message)

  return (
    <section className="crm-page" aria-labelledby="quote-heading">
      <Link className="crm-back crm-no-print" to={deal ? `/employee-portal/deals/${String(deal.id)}` : '/employee-portal/quotes'}><ArrowLeft size={14} />{deal ? String(deal.deal_number) : 'Quotes'}</Link>
      <div className="crm-record-head crm-no-print">
        <div className="crm-record-title">
          <div>
            <span className="crm-eyebrow">QUOTE / {String(quote.quote_number)}</span>
            <h2 id="quote-heading">{String(contact.display_name ?? 'Quote')}</h2>
            <div className="crm-record-sub">
              <StatusBadge value={status} />
              {deal ? <Link to={`/employee-portal/deals/${String(deal.id)}`}>{String(deal.deal_number)} · {String(deal.project_name ?? '')}</Link> : null}
              <span>Updated {relativeTime(quote.updated_at, now)}</span>
              {quote.sent_at ? <span>Sent {formatDate(quote.sent_at)}</span> : null}
            </div>
          </div>
          <div className="crm-record-actions">
            <button className="crm-btn" type="button" onClick={() => window.print()} disabled={dirty} title={dirty ? 'Save your changes before printing' : 'Print, or choose “Save as PDF” in the print dialog'}><Printer size={14} />Print / PDF</button>
            {editable ? <button className="crm-btn" type="button" disabled={busy || !dirty} onClick={() => void save()}><Save size={14} />{busy ? 'Saving…' : 'Save'}</button> : null}
            {editable ? <button className="crm-btn primary" type="button" disabled={busy || !parsed.some((line) => line.description.trim())} onClick={() => setStatus('sent', 'Quote marked sent.')}><Send size={14} />Mark sent</button> : null}
            {status === 'sent' ? <>
              <button className="crm-btn primary" type="button" disabled={busy} onClick={() => setStatus('accepted', 'Quote marked accepted.')}><Check size={14} />Accepted</button>
              <button className="crm-btn" type="button" disabled={busy} onClick={() => setStatus('declined', 'Quote marked declined.')}><X size={14} />Declined</button>
              <button className="crm-btn ghost" type="button" disabled={busy} onClick={() => setStatus('expired', 'Quote marked expired.')}>Expired</button>
            </> : null}
            {status !== 'draft' && status !== 'accepted' ? <button className="crm-btn ghost" type="button" disabled={busy} onClick={() => setStatus('draft', 'Quote reopened as a draft.')}><RotateCcw size={14} />Revise as draft</button> : null}
          </div>
        </div>
        {!editable ? <div className="crm-banner info"><Send size={16} /><span>This quote is <strong>{status}</strong>, so its lines are locked.{status !== 'accepted' ? ' Choose Revise as draft to change it.' : ''} “Sent” is a manual status — the portal does not email quotes.</span></div> : null}
      </div>

      <article className="crm-card crm-quote-sheet">
        <div className="crm-print-only" style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>CMAC Container Homes</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>Quote {String(quote.quote_number)} · {formatDate(quote.sent_at ?? quote.updated_at)}</p>
        </div>
        <dl className="crm-facts" style={{ marginBottom: 20 }}>
          <div><dt>Prepared for</dt><dd>{[contact.display_name, contact.company && contact.company !== contact.display_name ? contact.company : null, contact.email, contact.phone].filter(Boolean).join('\n')}</dd></div>
          <div><dt>Project</dt><dd>{[deal?.project_name, deal?.project_address ?? contact.project_address].filter(Boolean).join('\n') || '—'}</dd></div>
          <div><dt>Prepared by</dt><dd>{[preparedBy?.display_name, preparedBy?.email, preparedBy?.phone].filter(Boolean).join('\n') || 'CMAC Container Homes'}</dd></div>
          <div><dt>Quote</dt><dd>{String(quote.quote_number)}{deal ? `\nDeal ${String(deal.deal_number)}` : ''}</dd></div>
        </dl>
        <div style={{ overflowX: 'auto' }}>
          <table className="crm-lines" style={{ minWidth: 520 }}>
            <thead><tr><th>Description</th><th className="qty">Qty</th><th className="num">Unit price</th><th className="num">Line total</th>{editable ? <th className="crm-no-print"><span className="sr-only">Remove</span></th> : null}</tr></thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.key}>
                  <td><input value={line.description} readOnly={!editable} onChange={(event) => patch(line.key, { description: event.target.value })} aria-label={`Line ${index + 1} description`} maxLength={300} placeholder="Item or service" /></td>
                  <td className="qty"><input className="num-input" type="number" min="0.01" step="0.01" inputMode="decimal" value={line.quantity} readOnly={!editable} onChange={(event) => patch(line.key, { quantity: event.target.value })} aria-label={`Line ${index + 1} quantity`} /></td>
                  <td className="num"><input className="num-input crm-no-print" type="number" min="0" step="0.01" inputMode="decimal" value={line.unit_price} readOnly={!editable} onChange={(event) => patch(line.key, { unit_price: event.target.value })} aria-label={`Line ${index + 1} unit price`} /><span className="crm-print-inline">{formatMoneyExact(line.unit_price)}</span></td>
                  <td className="total">{formatMoneyExact(toNumber(line.quantity) * toNumber(line.unit_price))}</td>
                  {editable ? <td className="crm-no-print" style={{ width: 40 }}><button className="crm-icon-btn" type="button" onClick={() => { setLines((current) => current.filter((item) => item.key !== line.key)); setDirty(true) }} aria-label={`Remove line ${index + 1}`}><Trash2 size={13} /></button></td> : null}
                </tr>
              ))}
              {!lines.length ? <tr><td colSpan={5} className="crm-dim" style={{ padding: '14px 0' }}>No lines yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {editable ? <button className="crm-btn small crm-no-print" type="button" onClick={addLine} style={{ marginTop: 10 }}><Plus size={13} />Add line</button> : null}
        <div className="crm-totals">
          <div><span>Subtotal</span><span>{formatMoneyExact(subtotal)}</span></div>
          <div><label htmlFor="quote-delivery">Delivery</label><input id="quote-delivery" className="crm-no-print" type="number" min="0" step="0.01" inputMode="decimal" value={delivery} readOnly={!editable} onChange={(event) => { setDelivery(event.target.value); setDirty(true) }} /><span className="crm-print-inline">{formatMoneyExact(delivery)}</span></div>
          <div><label htmlFor="quote-tax">Tax</label><input id="quote-tax" className="crm-no-print" type="number" min="0" step="0.01" inputMode="decimal" value={tax} readOnly={!editable} onChange={(event) => { setTax(event.target.value); setDirty(true) }} /><span className="crm-print-inline">{formatMoneyExact(tax)}</span></div>
          <div className="grand"><span>Total</span><span>{formatMoneyExact(total)}</span></div>
        </div>
        <label className="crm-field crm-no-print" style={{ marginTop: 18 }}><span>Notes and terms</span><textarea rows={3} value={notes} readOnly={!editable} onChange={(event) => { setNotes(event.target.value); setDirty(true) }} maxLength={4000} placeholder="Validity period, deposit terms, what is and is not included…" /></label>
        {notes.trim() ? <div className="crm-print-only" style={{ marginTop: 24 }}><strong style={{ fontSize: 12 }}>Notes and terms</strong><p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{notes}</p></div> : null}
        {dirty ? <p className="crm-form-error crm-no-print" style={{ marginTop: 12, color: 'var(--crm-progress)' }}>Unsaved changes.</p> : null}
      </article>
    </section>
  )
}

export default function QuoteDetailPage() {
  const { quoteId = '' } = useParams()
  const quote = useCrmRows('quotes', { select: quoteSelect, filter: { column: 'id', value: quoteId } })
  const items = useCrmRows('quote_items', { filter: { column: 'quote_id', value: quoteId }, orderBy: 'display_order', ascending: true, limit: 200 })
  const page = combineQueries(quote, items)
  if (page.loading) return <PortalLoading label="Opening quote" />
  if (page.error) return <PortalError message={page.error} retry={page.reload} />
  const record = quote.rows[0]
  if (!record) return <PortalEmpty title="Quote not found" copy="It may have been reassigned, or it is outside the records you can access." />
  // Remount the editor when the saved quote changes so its fields always start from what is stored.
  return <QuoteEditor key={`${String(record.updated_at)}-${String(record.status)}-${items.rows.map((item) => item.id).join()}`} quote={record} items={items.rows} />
}
