import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileCheck2,
  FileSignature,
  Files,
  Home,
  LogOut,
  Mail,
  MapPin,
  ReceiptText,
  Send,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'
import { Logo } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  CustomersView,
  DocumentsView,
  InventoryView,
  OverviewView,
  PortalNavigation,
} from '../components/portal/PortalViews'
import { portalSectionMeta, type PortalCustomer, type PortalDocument, type PortalSection, type PortalUnit } from '../components/portal/portal-data'

type Customer = {
  name: string
  email: string
  phone: string
  company: string
  projectAddress: string
  billingAddress: string
  deliveryTarget: string
  notes: string
}

const units: PortalUnit[] = [
  {
    id: 'CH-104',
    name: 'CMAC Living 40',
    subtitle: '1 bed / 1 bath / turn-key',
    status: 'Available now',
    leadTime: 'Ready for site review',
    image: '/minihomes-flagship.png',
    imageAlt: 'CMAC flagship container home exterior',
    price: 50000,
    Icon: Home,
  },
  {
    id: 'CH-112',
    name: 'CMAC Studio 40',
    subtitle: 'Open plan / 1 bath / flex',
    status: 'Build slot',
    leadTime: 'Target: 5-day build',
    image: '/solutions/custom-spaces.jpg',
    imageAlt: 'Wood-clad CMAC custom container space',
    price: 50000,
    Icon: Box,
  },
  {
    id: 'CH-118',
    name: 'CMAC Crew 40',
    subtitle: 'Workforce / multi-sleep / durable',
    status: 'Ready soon',
    leadTime: 'Final finish stage',
    image: '/solutions/workforce-housing.jpg',
    imageAlt: 'CMAC workforce container homes in production',
    price: 50000,
    Icon: Building2,
  },
]

const initialCustomer: Customer = {
  name: '',
  email: '',
  phone: '',
  company: '',
  projectAddress: '',
  billingAddress: '',
  deliveryTarget: '',
  notes: '',
}

const initialDocuments: PortalDocument[] = [
  { id: 'agreement', title: 'Purchase Agreement', detail: 'Unit, parties, price, terms, and signatures.', group: 'Required', selected: true },
  { id: 'invoice', title: 'Invoice & Deposit Schedule', detail: 'Deposit, milestone payments, and balance due.', group: 'Required', selected: true },
  { id: 'configuration', title: 'Configuration & Finish Schedule', detail: 'The exact layout, fixtures, finishes, and options.', group: 'Required', selected: true },
  { id: 'site', title: 'Site Readiness & Delivery Checklist', detail: 'Access, foundation, utilities, crane, and placement.', group: 'Recommended', selected: true },
  { id: 'warranty', title: 'Limited Warranty', detail: 'Coverage, exclusions, care, and claim process.', group: 'Recommended', selected: true },
  { id: 'changes', title: 'Change Order Policy', detail: 'How post-approval changes affect price and schedule.', group: 'Recommended', selected: true },
  { id: 'payment', title: 'Payment Instructions', detail: 'Approved payment channels and fraud safeguards.', group: 'Closing', selected: true },
  { id: 'bill', title: 'Bill of Sale', detail: 'Prepared now, issued once final payment clears.', group: 'Closing', selected: false },
]

const steps = [
  { number: 1, label: 'Select unit' },
  { number: 2, label: 'Customer' },
  { number: 3, label: 'Package' },
  { number: 4, label: 'Review' },
]

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function EmployeePortalPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [activeSection, setActiveSection] = useState<PortalSection>('sale')
  const [step, setStep] = useState(1)
  const [selectedUnitId, setSelectedUnitId] = useState(units[0].id)
  const [customer, setCustomer] = useState(initialCustomer)
  const [documents, setDocuments] = useState(initialDocuments)
  const [deliveryEstimate, setDeliveryEstimate] = useState('TBD after site review')
  const [depositPercent, setDepositPercent] = useState(10)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [libraryPreview, setLibraryPreview] = useState<PortalDocument | null>(null)
  const [sent, setSent] = useState(false)
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? units[0]
  const selectedDocumentCount = documents.filter((document) => document.selected).length
  const deposit = selectedUnit.price * (depositPercent / 100)
  const customerReady = Boolean(customer.name && customer.email && customer.phone && customer.projectAddress)
  const activeMeta = portalSectionMeta[activeSection]

  const completion = useMemo(() => {
    const checks = [Boolean(selectedUnit), customerReady, selectedDocumentCount >= 3, step === 4]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [customerReady, selectedDocumentCount, selectedUnit, step])

  useEffect(() => {
    document.title = 'Employee Sales Portal | CMAC Container Homes'
  }, [])

  function updateCustomer(field: keyof Customer, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }))
  }

  function toggleDocument(id: string) {
    setDocuments((current) => current.map((document) => (
      document.id === id ? { ...document, selected: !document.selected } : document
    )))
  }

  function advance(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setStep((current) => Math.min(4, current + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setStep((current) => Math.max(1, current - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function simulateSend() {
    setSent(true)
    setPreviewOpen(false)
  }

  function changeSection(section: PortalSection) {
    setActiveSection(section)
    setSent(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startSaleWithUnit(unitId: string) {
    setSelectedUnitId(unitId)
    setStep(2)
    changeSection('sale')
  }

  function prepareCustomerSale(record?: PortalCustomer) {
    setCustomer(record ? {
      name: record.name,
      email: record.email,
      phone: record.phone,
      company: record.company,
      projectAddress: `${record.location} — exact address pending`,
      billingAddress: '',
      deliveryTarget: '',
      notes: `Mock CRM record ${record.id}. Last contact: ${record.lastContact}.`,
    } : initialCustomer)
    setStep(2)
    changeSection('sale')
  }

  function addLibraryDocumentToSale(document: PortalDocument) {
    setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, selected: true } : item))
    setLibraryPreview(null)
    setStep(3)
    changeSection('sale')
  }

  return (
    <div className="employee-portal">
      <a className="skip-link" href="#portal-main">Skip to workspace</a>
      <aside className="portal-sidebar">
        <div className="portal-sidebar-logo"><Logo small brand="SALES PORTAL" onNavigate={onNavigate} /></div>
        <div className="portal-user">
          <div className="portal-avatar">JD</div>
          <div><strong>Jordan Davis</strong><span>Sales representative</span></div>
        </div>
        <PortalNavigation active={activeSection} onChange={changeSection} />
        <div className="portal-sidebar-bottom">
          <div className="portal-env"><span /> Prototype environment<strong>Nothing is sent or saved</strong></div>
          <button type="button" onClick={() => onNavigate('/login')}><LogOut size={17} aria-hidden="true" /> Exit portal</button>
        </div>
      </aside>

      <div className="portal-workspace">
        <header className="portal-topbar">
          <div><span className="portal-breadcrumb">{activeMeta.breadcrumb}</span><h1>{activeMeta.title}</h1></div>
          <div className="portal-top-actions">
            <ThemeToggle />
            <span className="draft-status"><span /> {activeSection === 'sale' ? 'Draft / not saved' : 'Prototype data'}</span>
            <button className="portal-exit-mobile" type="button" onClick={() => onNavigate('/login')}><LogOut size={17} /> Exit</button>
          </div>
        </header>

        <main id="portal-main" className="portal-main">
          <PortalNavigation active={activeSection} onChange={changeSection} mobile />
          <div className="portal-demo-banner"><ShieldCheck size={17} aria-hidden="true" /><p><strong>Demo mode:</strong> use fictional customer details only. Authentication, storage, signatures, invoices, and email delivery are not connected.</p></div>

          {activeSection === 'sale' ? (
            <>
          <ol className="portal-stepper" aria-label="Sale preparation progress">
            {steps.map((item) => (
              <li key={item.number} className={step === item.number ? 'current' : step > item.number ? 'complete' : ''}>
                <button type="button" onClick={() => item.number < step && setStep(item.number)} disabled={item.number > step} aria-current={step === item.number ? 'step' : undefined}>
                  <span>{step > item.number ? <Check size={15} aria-hidden="true" /> : item.number}</span>{item.label}
                </button>
              </li>
            ))}
          </ol>

          <div className="portal-content-grid">
            <section className="portal-stage" aria-live="polite">
              {step === 1 && (
                <div className="portal-panel">
                  <div className="portal-panel-heading"><div><span>STEP 01 / INVENTORY</span><h2>Choose the unit</h2><p>Select the container home this package will be built around.</p></div><span className="panel-count">3 demo units</span></div>
                  <div className="unit-picker">
                    {units.map((unit) => {
                      const selected = unit.id === selectedUnitId
                      return (
                        <button key={unit.id} type="button" className={selected ? 'unit-card selected' : 'unit-card'} onClick={() => setSelectedUnitId(unit.id)} aria-pressed={selected}>
                          <div className="unit-image"><img src={unit.image} alt={unit.imageAlt} /><span>{unit.status}</span></div>
                          <div className="unit-card-body">
                            <div className="unit-id"><unit.Icon size={16} aria-hidden="true" /> {unit.id}</div>
                            <h3>{unit.name}</h3><p>{unit.subtitle}</p>
                            <div className="unit-meta"><strong>{money.format(unit.price)}</strong><span><Clock3 size={13} aria-hidden="true" /> {unit.leadTime}</span></div>
                          </div>
                          <span className="unit-select-mark">{selected ? <Check size={14} aria-hidden="true" /> : null}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="portal-panel-actions"><span>Inventory shown is illustrative for testing.</span><button className="portal-primary-button" type="button" onClick={() => advance()}>Use {selectedUnit.id} <ArrowRight size={16} /></button></div>
                </div>
              )}

              {step === 2 && (
                <form className="portal-panel" onSubmit={advance}>
                  <div className="portal-panel-heading"><div><span>STEP 02 / BUYER RECORD</span><h2>Customer & site details</h2><p>Required fields become the source for the draft package.</p></div><span className="panel-count">* Required</span></div>
                  <div className="portal-form-grid">
                    <label>Full legal name *<input value={customer.name} onChange={(event) => updateCustomer('name', event.target.value)} placeholder="Taylor Morgan" required /></label>
                    <label>Email address *<input type="email" value={customer.email} onChange={(event) => updateCustomer('email', event.target.value)} placeholder="taylor@example.com" required /></label>
                    <label>Phone number *<input type="tel" value={customer.phone} onChange={(event) => updateCustomer('phone', event.target.value)} placeholder="(555) 000-0000" required /></label>
                    <label>Company / entity<input value={customer.company} onChange={(event) => updateCustomer('company', event.target.value)} placeholder="Optional" /></label>
                    <label className="field-wide">Project / delivery address *<input value={customer.projectAddress} onChange={(event) => updateCustomer('projectAddress', event.target.value)} placeholder="Street, city, state, ZIP" required /></label>
                    <label className="field-wide">Billing address<input value={customer.billingAddress} onChange={(event) => updateCustomer('billingAddress', event.target.value)} placeholder="Leave blank if same as project address" /></label>
                    <label>Preferred delivery window<input type="month" value={customer.deliveryTarget} onChange={(event) => updateCustomer('deliveryTarget', event.target.value)} /></label>
                    <label>Sales representative<input value="Jordan Davis" readOnly /></label>
                    <label className="field-wide">Project notes<textarea value={customer.notes} onChange={(event) => updateCustomer('notes', event.target.value)} placeholder="Site access, financing, finish requests, or important context…" rows={4} /></label>
                  </div>
                  <div className="portal-panel-actions"><button className="portal-text-button" type="button" onClick={goBack}><ArrowLeft size={15} /> Back</button><button className="portal-primary-button" type="submit">Build document package <ArrowRight size={16} /></button></div>
                </form>
              )}

              {step === 3 && (
                <div className="portal-panel">
                  <div className="portal-panel-heading"><div><span>STEP 03 / DOCUMENTS</span><h2>Build the sales package</h2><p>Choose what the buyer receives for review and signature.</p></div><span className="panel-count">{selectedDocumentCount} selected</span></div>
                  <div className="document-list">
                    {documents.map((document) => (
                      <label key={document.id} className={document.selected ? 'document-row selected' : 'document-row'}>
                        <input type="checkbox" checked={document.selected} onChange={() => toggleDocument(document.id)} />
                        <span className="document-check">{document.selected && <Check size={14} aria-hidden="true" />}</span>
                        <FileCheck2 size={20} aria-hidden="true" />
                        <span className="document-copy"><strong>{document.title}</strong><small>{document.detail}</small></span>
                        <span className={`document-group group-${document.group.toLowerCase()}`}>{document.group}</span>
                      </label>
                    ))}
                  </div>
                  <div className="legal-note"><ClipboardList size={17} aria-hidden="true" /><p><strong>Before launch:</strong> final templates should be approved by legal counsel, accounting, insurance, and operations for each state served.</p></div>
                  <div className="portal-panel-actions"><button className="portal-text-button" type="button" onClick={goBack}><ArrowLeft size={15} /> Back</button><button className="portal-primary-button" type="button" onClick={() => advance()}>Review package <ArrowRight size={16} /></button></div>
                </div>
              )}

              {step === 4 && (
                <div className="portal-panel review-panel">
                  <div className="portal-panel-heading"><div><span>STEP 04 / FINAL REVIEW</span><h2>Ready for customer review</h2><p>Confirm the record, commercial summary, and included documents.</p></div><span className="panel-count review-ready"><CheckCircle2 size={14} /> Ready</span></div>
                  <div className="review-section">
                    <div className="review-section-title"><UserRound size={18} aria-hidden="true" /><h3>Customer</h3><button type="button" onClick={() => setStep(2)}>Edit</button></div>
                    <dl className="review-details"><div><dt>Name</dt><dd>{customer.name || 'Demo customer'}</dd></div><div><dt>Email</dt><dd>{customer.email || 'demo@example.com'}</dd></div><div><dt>Phone</dt><dd>{customer.phone || '(555) 000-0000'}</dd></div><div><dt>Project site</dt><dd>{customer.projectAddress || 'Address pending'}</dd></div></dl>
                  </div>
                  <div className="review-section">
                    <div className="review-section-title"><ReceiptText size={18} aria-hidden="true" /><h3>Commercial summary</h3></div>
                    <div className="pricing-table"><div><span>{selectedUnit.name} / {selectedUnit.id}</span><strong>{money.format(selectedUnit.price)}</strong></div><div><span>Estimated delivery</span><strong>{deliveryEstimate}</strong></div><div><span>{depositPercent}% deposit due at signing</span><strong>{money.format(deposit)}</strong></div><div className="pricing-total"><span>Base contract value</span><strong>{money.format(selectedUnit.price)}</strong></div></div>
                    <p className="pricing-disclaimer">Taxes, permits, site work, delivery beyond included terms, and customer changes are excluded until confirmed.</p>
                  </div>
                  <div className="review-section">
                    <div className="review-section-title"><Files size={18} aria-hidden="true" /><h3>Package contents</h3><button type="button" onClick={() => setStep(3)}>Edit</button></div>
                    <div className="review-document-chips">{documents.filter((document) => document.selected).map((document) => <span key={document.id}><Check size={12} /> {document.title}</span>)}</div>
                  </div>
                  <div className="portal-panel-actions review-actions"><button className="portal-text-button" type="button" onClick={goBack}><ArrowLeft size={15} /> Back</button><div><button className="portal-secondary-button" type="button" onClick={() => setPreviewOpen(true)}><Download size={16} /> Preview package</button><button className="portal-primary-button" type="button" onClick={simulateSend}><Send size={16} /> Email package</button></div></div>
                </div>
              )}
            </section>

            <aside className="deal-summary" aria-label="Current sale summary">
              <div className="deal-summary-top"><div><span>TRANSACTION DRAFT</span><strong>CM-{new Date().getFullYear()}-0042</strong></div><span className="summary-progress">{completion}%</span></div>
              <div className="summary-progress-bar"><span style={{ width: `${completion}%` }} /></div>
              <div className="summary-unit"><img src={selectedUnit.image} alt="" /><div><span>{selectedUnit.id}</span><strong>{selectedUnit.name}</strong><small>{selectedUnit.subtitle}</small></div></div>
              <dl className="summary-data"><div><dt><WalletCards size={14} /> Base price</dt><dd>{money.format(selectedUnit.price)}</dd></div><div><dt><ReceiptText size={14} /> Deposit</dt><dd>{money.format(deposit)}</dd></div><div><dt><MapPin size={14} /> Delivery</dt><dd>{deliveryEstimate}</dd></div><div><dt><FileSignature size={14} /> Documents</dt><dd>{selectedDocumentCount} selected</dd></div></dl>
              <div className="summary-controls">
                <label>Deposit<select value={depositPercent} onChange={(event) => setDepositPercent(Number(event.target.value))}><option value={10}>10%</option><option value={20}>20%</option><option value={25}>25%</option></select></label>
                <label>Delivery estimate<select value={deliveryEstimate} onChange={(event) => setDeliveryEstimate(event.target.value)}><option>TBD after site review</option><option>Included — first 250 miles</option><option>Quoted separately</option></select></label>
              </div>
              <div className="summary-integrity"><ShieldCheck size={17} /><p>Final price and terms require manager approval before sending from the production system.</p></div>
            </aside>
          </div>
            </>
          ) : activeSection === 'overview' ? (
            <OverviewView onChange={changeSection} />
          ) : activeSection === 'inventory' ? (
            <InventoryView units={units} onStartSale={startSaleWithUnit} />
          ) : activeSection === 'documents' ? (
            <DocumentsView documents={documents} onPreview={setLibraryPreview} />
          ) : (
            <CustomersView onPrepareSale={prepareCustomerSale} />
          )}
        </main>
      </div>

      {previewOpen && (
        <div
          className="portal-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setPreviewOpen(false)}
          onKeyDown={(event) => event.key === 'Escape' && setPreviewOpen(false)}
        >
          <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <button className="modal-close" type="button" onClick={() => setPreviewOpen(false)} aria-label="Close preview" autoFocus><X size={18} /></button>
            <div className="modal-icon"><FileSignature size={28} /></div><span>DEMO DOCUMENT PREVIEW</span><h2 id="preview-title">{selectedDocumentCount}-document customer package</h2><p>This preview represents the future generated PDF and e-signature envelope for <strong>{customer.name || 'Demo Customer'}</strong>.</p>
            <div className="modal-summary"><span>{selectedUnit.id} / {selectedUnit.name}</span><strong>{money.format(selectedUnit.price)}</strong></div>
            <div className="modal-actions"><button className="portal-secondary-button" type="button" onClick={() => setPreviewOpen(false)}>Keep editing</button><button className="portal-primary-button" type="button" onClick={simulateSend}><Mail size={16} /> Simulate email</button></div>
          </section>
        </div>
      )}

      {libraryPreview && (
        <div
          className="portal-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setLibraryPreview(null)}
          onKeyDown={(event) => event.key === 'Escape' && setLibraryPreview(null)}
        >
          <section className="portal-modal template-preview-modal" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
            <button className="modal-close" type="button" onClick={() => setLibraryPreview(null)} aria-label="Close template preview" autoFocus><X size={18} /></button>
            <div className="modal-icon"><FileCheck2 size={28} /></div>
            <span>CONTROLLED TEMPLATE / DEMO</span>
            <h2 id="template-preview-title">{libraryPreview.title}</h2>
            <p>{libraryPreview.detail}</p>
            <div className="template-preview-sheet" aria-label="Mock document contents">
              <div><span>CMAC CONTAINER HOMES</span><b>{libraryPreview.title}</b></div>
              <p>This preview represents the structure of the future production document. Customer, unit, pricing, and jurisdiction fields will be generated from the completed sale record.</p>
              <span /><span /><span />
              <small>Prototype template — not legal or financial advice</small>
            </div>
            <div className="modal-actions"><button className="portal-secondary-button" type="button" onClick={() => setLibraryPreview(null)}>Close preview</button><button className="portal-primary-button" type="button" onClick={() => addLibraryDocumentToSale(libraryPreview)}>Add to new sale <ArrowRight size={15} /></button></div>
          </section>
        </div>
      )}

      {sent && (
        <div className="portal-toast" role="status">
          <CheckCircle2 size={22} aria-hidden="true" /><div><strong>Demo complete — nothing was sent</strong><span>The customer package flow is ready for UI testing.</span></div><button type="button" onClick={() => setSent(false)} aria-label="Dismiss notification"><X size={17} /></button>
        </div>
      )}
    </div>
  )
}
