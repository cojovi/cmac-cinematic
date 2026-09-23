import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, LoaderCircle, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { Logo } from '../components/ui'
import { emptyQrAnswers, qrOptions, qrQuestions, validateQrAnswers, type QrAnswers, type QrErrors, type QrEmailStatus } from '../../supabase/functions/_shared/qr'
import { qrRequest, qrVisitId } from '../lib/qr-api'

const steps = ['The starting point', 'Your space', 'Let’s connect']
const stepFields: (keyof QrAnswers)[][] = [['location', 'timing'], ['units', 'use'], ['payment', 'credit', 'name', 'email', 'phone']]
export default function QrPage() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<QrAnswers>({ ...emptyQrAnswers })
  const [errors, setErrors] = useState<QrErrors>({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [receipt, setReceipt] = useState<QrEmailStatus | null>(null)
  const [ids] = useState(() => {
    let storage: Storage | null = null
    try { storage = sessionStorage } catch { /* Private browsing may block storage. */ }
    return { visit: qrVisitId(storage), submission: crypto.randomUUID() }
  })
  const form = useRef<HTMLFormElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const visitRequest = useRef<Promise<unknown> | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    const oldTitle = document.title
    document.title = 'Find your container home | CMAC'
    // Analytics failure must never prevent the customer from submitting.
    visitRequest.current ??= qrRequest({ action: 'visit', visit_id: ids.visit }).catch(() => undefined)
    return () => { document.title = oldTitle }
  }, [ids.visit])

  function update(key: keyof QrAnswers, value: string) {
    setAnswers(previous => ({ ...previous, [key]: value, ...(key === 'payment' && value === 'Cash' ? { credit: '' } : {}) }))
    setErrors(previous => ({ ...previous, [key]: undefined }))
    setError('')
  }
  function focusHeading() { requestAnimationFrame(() => heading.current?.focus()) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const result = validateQrAnswers(answers)
    const relevant = Object.fromEntries(Object.entries(result.errors).filter(([key]) => step === 2 || stepFields[step].includes(key as keyof QrAnswers)))
    setErrors(relevant)
    if (Object.keys(relevant).length) {
      const first = Object.keys(relevant)[0]
      const failedStep = stepFields.findIndex(fields => fields.includes(first as keyof QrAnswers))
      if (failedStep < step) setStep(failedStep)
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus())
      return
    }
    if (step < 2) { setStep(step + 1); focusHeading(); return }
    submitting.current = true; setPending(true); setError('')
    try {
      const website = (new FormData(event.currentTarget).get('website') as string) || ''
      const response = await qrRequest({ action: 'submit', submission_id: ids.submission, visit_id: ids.visit, answers: result.data, website })
      if (!response.accepted) throw new Error('We could not confirm receipt. Please try again.')
      setReceipt(response.email_status ?? 'pending'); focusHeading()
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again. Your answers have been kept.') }
    finally { submitting.current = false; setPending(false) }
  }
  function question(key: keyof typeof qrOptions, number: string) {
    return <fieldset className="qr-question" aria-describedby={errors[key] ? `qr-${key}-error` : undefined}>
      <legend><span>{number}</span>{qrQuestions[key]}</legend>
      <div className={`qr-options qr-options-${key}`}>{qrOptions[key].map(option => <label className="qr-option" key={option}>
        <input type="radio" name={key} value={option} checked={answers[key] === option} onChange={() => update(key, option)} aria-invalid={Boolean(errors[key])} />
        <span className="qr-option-check"><Check size={14} /></span><span>{option}</span>
      </label>)}</div>
      {errors[key] ? <p className="qr-field-error" id={`qr-${key}-error`}>{errors[key]}</p> : null}
    </fieldset>
  }
  return <div className="qr-page">
    <a className="skip-link" href="#qr-main">Skip to inquiry form</a>
    <header className="qr-header"><Logo /><a href="tel:6822187221"><Phone size={16} /><span>(682) 218-7221</span></a></header>
    <main id="qr-main" className="qr-layout">
      <aside className="qr-intro">
        <span className="qr-eyebrow"><span /> TEXAS BUILT. YOUR NEXT CHAPTER.</span>
        <h1>Seen it. <br />Now make <br />it <em>yours.</em></h1>
        <p>A little space. A lot of possibilities. Tell us what you have in mind, and Charley will help you take the next step.</p>
        <div className="qr-image"><img src="/minihomes-flagship.png" alt="CMAC container home with wood siding and black entry doors at dusk" /><span><MapPin size={14} /> Burleson & Weatherford, Texas</span></div>
        <p className="qr-intro-note"><ShieldCheck size={17} /> No commitment. Just a conversation.</p>
      </aside>
      <section className="qr-form-card" aria-label="Container home inquiry">
        {receipt ? <div className="qr-success" role="status"><CheckCircle2 size={46} /><span className="qr-eyebrow">YOUR NEXT CHAPTER / STARTED</span><h2 ref={heading} tabIndex={-1}>You’re on our list.</h2><p>Your answers and contact details have been saved.</p><p>{receipt === 'sent' ? 'Charley has been notified by email and can follow up with you.' : 'Charley’s email notification is awaiting confirmation. There’s no need to submit again—your inquiry is safely recorded.'}</p><a className="btn btn-red" href="tel:6822187221"><Phone size={16} /> Talk to us now</a><a className="qr-text-link" href="/">Explore CMAC Container Homes <ArrowRight size={16} /></a></div> : <>
          <div className="qr-progress" aria-label={`Step ${step + 1} of 3`}><span>LET’S BUILD YOUR NEXT STEP</span><b>0{step + 1} / 03</b><div>{steps.map((label, index) => <span key={label} className={index <= step ? 'is-complete' : ''} />)}</div></div>
          <h2 ref={heading} tabIndex={-1}>{steps[step]}</h2><p className="qr-step-copy">{step === 0 ? 'Spotted a home you like? You’re in the right place.' : step === 1 ? 'Tell us how your new space will fit into your life.' : 'One last detail, then tell Charley how to reach you.'}</p>
          <form ref={form} onSubmit={submit} noValidate>
            <fieldset className="qr-form-fields" disabled={pending}>
              {step === 0 ? <>{question('location', '01')}{question('timing', '02')}</> : null}
              {step === 1 ? <>{question('units', '03')}{question('use', '04')}</> : null}
              {step === 2 ? <>{question('payment', '05')}{answers.payment === 'Financing' ? <>{question('credit', '06')}<p className="qr-privacy-note">Self-reported only. No credit check, score, or financial documents required.</p></> : null}
                <div className="qr-contact"><h3>Where can we reach you?</h3>{(['name', 'email', 'phone'] as const).map(key => <label key={key} htmlFor={`qr-${key}`}><span>{key === 'name' ? 'Full name' : key === 'email' ? 'Email address' : 'Phone number'} <small>Required</small></span><input id={`qr-${key}`} name={key} type={key === 'phone' ? 'tel' : key === 'email' ? 'email' : 'text'} autoComplete={key === 'phone' ? 'tel' : key} maxLength={key === 'name' ? 120 : key === 'email' ? 254 : 40} value={answers[key]} onChange={event => update(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `qr-${key}-error` : undefined} />{errors[key] ? <span className="qr-field-error" id={`qr-${key}-error`}>{errors[key]}</span> : null}</label>)}</div>
                <p className="qr-privacy-note">We’ll store your inquiry and send your answers and contact details to Charley at CMAC so he can respond. This is not a financing application.</p>
              </> : null}
              <div className="qr-honeypot" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            </fieldset>
            {Object.values(errors).some(Boolean) ? <p className="qr-field-error" role="alert">Please complete the highlighted fields.</p> : null}
            {error ? <p className="qr-error" role="alert">{error}</p> : null}
            <div className="qr-form-actions">{step > 0 ? <button className="qr-back" type="button" disabled={pending} onClick={() => { setStep(step - 1); setErrors({}); focusHeading() }}><ArrowLeft size={16} /> Back</button> : <span>ABOUT 2 MINUTES</span>}<button className="btn btn-red" type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={17} /> Sending inquiry…</> : <>{step < 2 ? 'Continue' : 'Send my inquiry'}<ArrowRight size={17} /></>}</button></div>
          </form>
        </>}
      </section>
    </main>
    <footer className="qr-footer"><span>CMAC CONTAINER HOMES / BUILT IN TEXAS</span><span>© {new Date().getFullYear()} cojovi.com. All rights reserved.</span></footer>
  </div>
}
