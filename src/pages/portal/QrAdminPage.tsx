import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, CheckCircle2, Mail, QrCode, RefreshCw, ScanLine, Send, TriangleAlert } from 'lucide-react'
import { PortalEmpty, PortalError, PortalLoading } from '../../components/portal/AsyncState'
import { supabase } from '../../lib/supabase'
import { qrRequest, type QrReport } from '../../lib/qr-api'
import { qrQuestions, qrRecipient, type QrEmailStatus } from '../../../supabase/functions/_shared/qr'

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const statusLabels: Record<QrEmailStatus, string> = { pending: 'Awaiting email', sending: 'Sending / verify if delayed', sent: 'Email sent', failed: 'Email failed', not_configured: 'Email setup needed', unknown: 'Verify in Gmail' }

export default function QrAdminPage() {
  const [range, setRange] = useState({ days: 30, offset: 0 })
  const [data, setData] = useState<QrReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retrying, setRetrying] = useState<string | null>(null)
  const generation = useRef(0)
  const retryLock = useRef(false)
  const load = useCallback(async () => {
    const current = ++generation.current
    setLoading(true); setError('')
    try {
      if (!supabase) throw new Error('QR reporting is not configured in this environment.')
      const result = await supabase.rpc('qr_admin_report', { p_days: range.days, p_offset: range.offset })
      if (result.error) throw new Error(/PGRST202|42883/.test(result.error.code) ? 'QR reporting is not installed in this database yet. The QR migration must be deployed before live reporting is available.' : result.error.message)
      if (generation.current === current) setData(result.data as unknown as QrReport)
    } catch (err) { if (generation.current === current) { setData(null); setError(err instanceof Error ? err.message : 'QR report could not be loaded.') } }
    finally { if (generation.current === current) setLoading(false) }
  }, [range.days, range.offset])
  useEffect(() => {
    const requests = generation
    let mounted = true
    void Promise.resolve().then(() => { if (mounted) void load() })
    return () => { mounted = false; requests.current++ }
  }, [load])
  async function retry(id: string) {
    if (retryLock.current || !window.confirm(`Retry this inquiry email to ${qrRecipient}? The customer will not receive an email.`)) return
    retryLock.current = true; setRetrying(id); setNotice('')
    try {
      const result = await qrRequest({ action: 'retry', submission_id: id })
      setNotice(result.email_status === 'sent' ? 'Gmail confirmed the email was sent to Charley.' : 'The inquiry is saved, but the email is still unconfirmed. Review its updated status below.')
      await load()
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Email could not be retried.') }
    finally { retryLock.current = false; setRetrying(null) }
  }
  const conversion = data?.visits ? `${Math.round(data.converted_visits / data.visits * 100)}%` : '—'
  const metrics = data ? [
    { label: 'QR-page visits', value: data.visits, note: 'Tracked 30-minute tab sessions', Icon: ScanLine },
    { label: 'Saved inquiries', value: data.submissions, note: 'Complete forms safely recorded', Icon: ArrowDownToLine },
    { label: 'Emails sent', value: data.sent, note: 'Gmail-confirmed sends to Charley', Icon: Send },
    { label: 'Visit conversion', value: conversion, note: 'Tracked visits with an inquiry', Icon: CheckCircle2 },
  ] : []
  return <section className="portal-library-view qr-admin" aria-labelledby="qr-admin-heading">
    <div className="workspace-view-heading"><div><span>ADMIN / ON-SITE INTEREST</span><h2 id="qr-admin-heading">From scan to conversation.</h2><p>One place to follow visits, inquiries, and notifications to Charley.</p></div><QrCode size={34} /></div>
    <div className="qr-admin-toolbar"><a className="qr-page-link" href="/qr" target="_blank" rel="noreferrer">Open customer form <ArrowUpRight size={17} /></a><label>Reporting period<select value={range.days} disabled={retrying !== null} onChange={event => setRange({ days: Number(event.target.value), offset: 0 })}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={0}>All time</option></select></label><button className="portal-secondary-button" type="button" disabled={loading || retrying !== null} onClick={() => void load()}><RefreshCw size={15} /> Refresh</button></div>
    {notice ? <p className="qr-admin-notice" role="status">{notice}</p> : null}
    {loading ? <PortalLoading label="Loading QR activity" /> : error ? <PortalError message={error} retry={() => void load()} /> : data ? <>
      <div className="portal-metric-grid">{metrics.map(({ label, value, note, Icon }) => <article className="portal-metric-card" key={label}><div><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small>{note}</small></article>)}</div>
      <div className="qr-report-explainer"><ScanLine size={20} /><p>Visits are page opens, not verified physical QR scans or unique people. Refreshes in the same 30-minute tab session count once; bots, blocked tracking, and direct links can affect totals. <strong>Sent means Gmail accepted the email—not proof it was read or reached the inbox.</strong></p></div>
      {data.attention > 0 ? <p className="qr-admin-notice"><TriangleAlert size={18} />{data.attention} {data.attention === 1 ? 'inquiry needs' : 'inquiries need'} email attention. All answers remain saved here.</p> : null}
      <div className="qr-inquiries-title"><h3>Inquiries</h3><span>Notifications → {qrRecipient}</span></div>
      {!data.rows.length ? <PortalEmpty title="No QR inquiries yet" copy="Completed customer forms will appear here. Counts update when you refresh this report." /> : <div className="qr-inquiries">{data.rows.map(row => <details className="qr-inquiry" key={row.id}>
        <summary><span className="qr-inquiry-person"><strong>{row.name}</strong><span>{row.location} · {row.units}</span></span><span className="qr-inquiry-date">{date.format(new Date(row.created_at))}</span><span className={row.email_status === 'sent' ? 'status-pill success' : 'status-pill warning'}>{statusLabels[row.email_status]}</span></summary>
        <div className="qr-inquiry-body"><div className="qr-customer-contact"><a href={`mailto:${row.email}`}><Mail size={15} />{row.email}</a><a href={`tel:${row.phone.replace(/[^+\d]/g, '')}`}>{row.phone}</a></div><dl>{Object.entries(qrQuestions).map(([key, question]) => <div key={key}><dt>{question}</dt><dd>{String(row[key as keyof typeof qrQuestions] || 'Not applicable — cash')}</dd></div>)}</dl>
          <div className="qr-notification-detail"><p>{row.sent_at ? `Sent ${date.format(new Date(row.sent_at))}` : row.email_error || 'Notification has not been confirmed. A delayed “Sending” status needs manual verification in Charley’s Sent mail.'}</p>{['pending','failed','not_configured'].includes(row.email_status) && row.attempts < 5 ? <button className="portal-secondary-button" type="button" disabled={retrying !== null} onClick={() => void retry(row.id)}><RefreshCw size={15} />{retrying === row.id ? 'Retrying…' : 'Retry email to Charley'}</button> : row.attempts >= 5 ? <p>Retry limit reached. Please review email configuration.</p> : null}</div>
        </div>
      </details>)}</div>}
      <div className="qr-pagination"><button className="portal-secondary-button" type="button" disabled={range.offset === 0 || retrying !== null} onClick={() => setRange(previous => ({ ...previous, offset: Math.max(0, previous.offset - 25) }))}>Previous</button><span>{data.submissions ? `${range.offset + 1}–${Math.min(range.offset + 25, data.submissions)} of ${data.submissions}` : '0 inquiries'}</span><button className="portal-secondary-button" type="button" disabled={range.offset + 25 >= data.submissions || retrying !== null} onClick={() => setRange(previous => ({ ...previous, offset: previous.offset + 25 }))}>Next</button></div><p className="qr-report-updated">Updated {date.format(new Date(data.generated_at))} · All times shown in your local timezone.</p>
    </> : null}
  </section>
}
