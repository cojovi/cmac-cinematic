import { type FormEvent, useEffect, useState } from 'react'
import {
  ArrowRight,
  Box,
  Building2,
  CalendarDays,
  Check,
  ClipboardCheck,
  Factory,
  Hammer,
  Headphones,
  Home,
  LayoutGrid,
  Mail,
  MapPinned,
  Package,
  Phone,
  Ruler,
  Shield,
  Sparkles,
  Truck,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { SiteHeader } from '../components/SiteHeader'
import { ServiceAreaMap } from '../components/ServiceAreaMap'
import { IconBox, Logo, RedButton } from '../components/ui'

const trustBadges = [
  { title: 'TEXAS BUILT', detail: 'Crafted in the Lone Star State', Icon: MapPinned },
  { title: 'FLEXIBLE PLANS', detail: 'Layouts shaped around your use', Icon: LayoutGrid },
  { title: 'TURN-KEY FINISH', detail: 'Designed to arrive move-in ready', Icon: Shield },
  { title: 'DELIVERY AVAILABLE', detail: 'Nationwide project support', Icon: Truck },
]

const solutions = [
  {
    eyebrow: '01 / RESIDENTIAL',
    title: 'Turn-Key Living',
    body: 'A complete living environment with kitchenette, full bath, HVAC, and durable vinyl plank flooring—finished before it reaches your site.',
    detail: 'Move-in focused',
    image: '/solutions/turnkey-living.jpg',
    imageAlt: 'Finished CMAC container home interior with sleeping, dining, and living areas',
    Icon: Home,
  },
  {
    eyebrow: '02 / COMMERCIAL',
    title: 'Workforce Housing',
    body: 'Repeatable, transportable housing for data-center builds, construction crews, and demanding remote-site operations.',
    detail: 'Built to scale',
    image: '/solutions/workforce-housing.jpg',
    imageAlt: 'Multiple CMAC container units being produced inside the Texas facility',
    Icon: Building2,
  },
  {
    eyebrow: '03 / FLEXIBLE',
    title: 'Custom Spaces',
    body: 'Offices, studios, guest suites, and adaptable rooms built inside a reinforced Corten steel shell.',
    detail: 'Made for your use',
    image: '/solutions/custom-spaces.jpg',
    imageAlt: 'Finished wood-clad CMAC container unit with two private entrances',
    Icon: Factory,
  },
]

const serviceStates = ['Texas', 'Louisiana', 'Florida', 'Tennessee', 'Arkansas', 'Ohio', 'Oklahoma', 'California']

const processSteps = [
  { n: '01', title: 'Consult & Design', detail: 'Define use, layout, finishes, site, and delivery.', Icon: ClipboardCheck },
  { n: '02', title: 'Reinforce the Shell', detail: 'Frame every opening and prepare the steel structure.', Icon: Box },
  { n: '03', title: 'Rough-In Systems', detail: 'Route electrical, plumbing, insulation, and HVAC.', Icon: Wrench },
  { n: '04', title: 'Finish the Interior', detail: 'Install surfaces, fixtures, millwork, and flooring.', Icon: Hammer },
  { n: '05', title: 'Inspect & Deliver', detail: 'Complete quality control and coordinate placement.', Icon: Truck },
]

const specs = [
  { value: '40 FT', title: 'Flagship footprint', note: 'Full-size modular platform' },
  { value: '8 FT', title: 'Interior height', note: 'Comfortable standing room' },
  { value: '250 MI', title: 'Launch delivery', note: 'Included on the first miles' },
  { value: '5 DAY', title: 'Build cycle target', note: 'Shell-to-finish workflow' },
]

const anatomyLayers = [
  { n: '01', title: 'Corten Steel Shell', note: 'A durable corrugated structural starting point.' },
  { n: '02', title: 'Reinforced Openings', note: 'Steel box-tube framing around doors and windows.' },
  { n: '03', title: 'Interior Framing', note: 'Flexible wall structure for thoughtful room planning.' },
  { n: '04', title: 'Thermal Envelope', note: 'High-performance insulation and vapor control.' },
  { n: '05', title: 'Integrated Systems', note: 'Electrical, plumbing, and HVAC planned before closure.' },
  { n: '06', title: 'Durable Finish Layer', note: 'Water-resistant flooring and hard-wearing surfaces.' },
]

const applications = [
  {
    title: 'A place of your own',
    body: 'A compact primary home, private guest suite, or independent backyard retreat.',
    tag: 'Residential',
    Icon: Home,
  },
  {
    title: 'A better crew base',
    body: 'Repeatable workforce lodging that can move as the next project takes shape.',
    tag: 'Workforce',
    Icon: Warehouse,
  },
  {
    title: 'A room that works harder',
    body: 'A focused office, studio, hospitality unit, or site command space.',
    tag: 'Commercial',
    Icon: Building2,
  },
]

type ConsultationForm = {
  name: string
  phone: string
  email: string
  projectType: string
  location: string
  timing: string
}

const initialForm: ConsultationForm = {
  name: '',
  phone: '',
  email: '',
  projectType: '',
  location: '',
  timing: '',
}

export default function ContainerHomesPage({ onRouteNavigate }: { onRouteNavigate: (path: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [formStatus, setFormStatus] = useState('')

  useEffect(() => {
    document.title = 'CMAC Container Homes | Texas-Built Modular Living'
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    description?.setAttribute(
      'content',
      'Texas-built container homes and modular spaces by CMAC. Explore turn-key living, workforce housing, custom layouts, and nationwide delivery support.',
    )
  }, [])

  function updateField(field: keyof ConsultationForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function submitConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const subject = encodeURIComponent(`Container home consultation — ${form.name}`)
    const body = encodeURIComponent(
      `Name: ${form.name}\nPhone: ${form.phone}\nEmail: ${form.email}\nProject type: ${form.projectType}\nProject location: ${form.location}\nTiming: ${form.timing}`,
    )
    setFormStatus('Opening a prefilled message in your email app…')
    window.location.href = `mailto:info@cmaccontainers.com?subject=${subject}&body=${body}`
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="site-shell">
        <SiteHeader
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((open) => !open)}
          onNavigate={() => setMenuOpen(false)}
          onRouteNavigate={onRouteNavigate}
        />

        <main id="main-content">
          <section id="home" className="hero hero-containers" aria-labelledby="hero-title">
            <div className="container-hero-bg" aria-hidden="true" />
            <div className="blueprint-overlay" aria-hidden="true" />
            <div className="hero-copy">
              <span className="hero-kicker"><span className="signal-dot" /> Texas-built / nationwide delivery</span>
              <h1 id="hero-title"><span>Container</span><span>Homes</span></h1>
              <p className="hero-sub">Steel-born spaces, finished for real life.</p>
              <p className="hero-body">
                CMAC transforms proven shipping-container structures into refined homes, workforce housing, offices,
                and flexible spaces—built with discipline from the shell out.
              </p>
              <div className="hero-buttons">
                <RedButton href="#consultation">Plan Your Build</RedButton>
                <a className="btn btn-outline" href="#models">Explore the 40ft Model</a>
              </div>
              <div className="hero-spec-rail" aria-label="Flagship model highlights">
                <span><b>40 FT</b> flagship platform</span>
                <span><b>TURN-KEY</b> finish options</span>
                <span><b>DELIVERED</b> to your site</span>
              </div>
            </div>

            <form id="consultation" className="consultation-card" onSubmit={submitConsultation}>
              <div className="form-heading">
                <span className="section-index">START / 01</span>
                <h2>Tell us what you’re building.</h2>
                <p>Share the essentials. We’ll help shape the next step.</p>
              </div>
              <div className="form-grid">
                <label>
                  <span>Full name</span>
                  <input name="name" autoComplete="name" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
                </label>
                <label>
                  <span>Phone</span>
                  <input name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} required />
                </label>
                <label className="form-wide">
                  <span>Email</span>
                  <input name="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
                </label>
                <label className="form-wide">
                  <span>Project type</span>
                  <select name="projectType" value={form.projectType} onChange={(event) => updateField('projectType', event.target.value)} required>
                    <option value="" disabled>Select a use</option>
                    <option>Container home</option>
                    <option>Workforce housing</option>
                    <option>Office or studio</option>
                    <option>Hospitality or guest suite</option>
                    <option>Other custom space</option>
                  </select>
                </label>
                <label>
                  <span>Project location</span>
                  <input name="location" autoComplete="address-level2" placeholder="City, State" value={form.location} onChange={(event) => updateField('location', event.target.value)} required />
                </label>
                <label>
                  <span>Ideal timing</span>
                  <select name="timing" value={form.timing} onChange={(event) => updateField('timing', event.target.value)} required>
                    <option value="" disabled>Choose timing</option>
                    <option>As soon as possible</option>
                    <option>1–3 months</option>
                    <option>3–6 months</option>
                    <option>6+ months</option>
                    <option>Just exploring</option>
                  </select>
                </label>
              </div>
              <button className="form-submit" type="submit">Start My Project <ArrowRight size={16} aria-hidden="true" /></button>
              <small>Opens a prefilled message to the CMAC team. No obligation.</small>
              <p className="form-status" aria-live="polite">{formStatus}</p>
            </form>

            <div className="trust-row">
              {trustBadges.map(({ title, detail, Icon }) => (
                <div className="trust-item" key={title}>
                  <IconBox soft><Icon size={18} aria-hidden="true" /></IconBox>
                  <span><b>{title}</b><em>{detail}</em></span>
                </div>
              ))}
            </div>
          </section>

          <section id="models" className="panel flagship-panel" aria-labelledby="flagship-title">
            <div className="flagship-art" aria-hidden="true" />
            <div className="flagship-copy">
              <span className="section-index">MODEL / 01</span>
              <span className="section-label red">Flagship platform</span>
              <h2 id="flagship-title">The 40ft Modular Container Home</h2>
              <p>A strong, adaptable platform with enough room to live beautifully—and a footprint built to move.</p>
              <div className="feature-checks">
                <span><Check size={15} /> 40ft × 8ft × 8.5ft</span>
                <span><Check size={15} /> Approx. 8ft interior height</span>
                <span><Check size={15} /> Turn-key finish packages</span>
              </div>
              <RedButton href="#consultation">Request Model Details</RedButton>
            </div>
            <aside className="model-callout">
              <span className="callout-icon"><Truck size={22} aria-hidden="true" /></span>
              <span className="section-index">DELIVERY NOTE</span>
              <strong>First 250 miles included at launch.</strong>
              <a href="#consultation">Check your location <ArrowRight size={13} /></a>
            </aside>
          </section>

          <section className="panel solutions-panel" aria-labelledby="solutions-title">
            <div className="section-heading split-heading">
              <div>
                <span className="section-index">BUILT AROUND YOU / 02</span>
                <span className="section-label">One platform. Many possibilities.</span>
              </div>
              <h2 id="solutions-title">Not a tiny concept. A serious space.</h2>
            </div>
            <div className="solution-grid">
              {solutions.map(({ eyebrow, title, body, detail, image, imageAlt, Icon }) => (
                <article className="solution-card" key={title}>
                  <div className="solution-media">
                    <img src={image} alt={imageAlt} loading="lazy" />
                    <span className="solution-image-wash" aria-hidden="true" />
                    <span className="corner-mark top-left" /><span className="corner-mark bottom-right" />
                    <span className="solution-icon"><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></span>
                  </div>
                  <span className="section-index">{eyebrow}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <a href="#consultation">{detail} <ArrowRight size={14} /></a>
                </article>
              ))}
            </div>
          </section>

          <section id="service-area" className="panel service-area-panel" aria-labelledby="service-area-title">
            <div className="service-area-copy">
              <span className="section-index">SERVICE NETWORK / 03</span>
              <span className="section-label">Texas built. Multi-state reach.</span>
              <h2 id="service-area-title">Proudly serving 8 states.</h2>
              <p>
                CMAC supports container-home and modular-space projects across eight key markets, with delivery planning
                shaped around your site and scope.
              </p>
              <ul className="service-state-list" aria-label="States served">
                {serviceStates.map((state) => <li key={state}>{state}</li>)}
              </ul>
              <div className="service-area-note">
                <Truck size={20} aria-hidden="true" />
                <span><b>Planning a project elsewhere?</b><small>Talk with our team about delivery availability.</small></span>
              </div>
              <RedButton href="#consultation">Check Your Location</RedButton>
            </div>
            <ServiceAreaMap />
          </section>

          <section id="process" className="panel process-panel" aria-labelledby="process-title">
            <div className="section-heading process-heading">
              <div>
                <span className="section-index">HOW IT’S MADE / 04</span>
                <span className="section-label">A disciplined build path</span>
              </div>
              <h2 id="process-title">From steel shell to finished space.</h2>
              <p>Every system is planned in sequence, so what gets hidden behind the walls is as considered as what you see.</p>
            </div>
            <ol className="process-timeline">
              {processSteps.map(({ n, title, detail, Icon }) => (
                <li className="process-step" key={n}>
                  <span className="process-number">{n}</span>
                  <span className="process-icon"><Icon size={21} aria-hidden="true" /></span>
                  <h3>{title}</h3><p>{detail}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel spec-panel" aria-labelledby="spec-title">
            <div className="section-heading compact-heading">
              <div>
                <span className="section-index">AT A GLANCE / 05</span>
                <span className="section-label">Flagship specifications</span>
              </div>
              <h2 id="spec-title">Compact footprint. Full-scale thinking.</h2>
            </div>
            <div className="spec-grid">
              {specs.map(({ value, title, note }) => (
                <article className="spec-card" key={title}><strong>{value}</strong><span>{title}</span><small>{note}</small></article>
              ))}
            </div>
          </section>

          <section id="craftsmanship" className="panel anatomy-panel" aria-labelledby="anatomy-title">
            <div className="anatomy-intro">
              <span className="section-index">UNDER THE CLADDING / 06</span>
              <span className="section-label">Craftsmanship you can trace</span>
              <h2 id="anatomy-title">Built from the outside in.</h2>
              <p>The container is only the beginning. CMAC layers structure, comfort, systems, and finish into one cohesive build.</p>
              <div className="anatomy-seal" aria-hidden="true"><Ruler size={27} /><span>6 CORE SYSTEMS</span></div>
            </div>
            <div className="anatomy-grid">
              {anatomyLayers.map(({ n, title, note }) => (
                <article className="anatomy-card" key={n}>
                  <span className="anatomy-number">{n}</span><span className="anatomy-line" aria-hidden="true" />
                  <div><h3>{title}</h3><p>{note}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel applications-panel" aria-labelledby="applications-title">
            <div className="section-heading applications-heading">
              <div>
                <span className="section-index">MADE FOR REAL LIFE / 07</span>
                <span className="section-label">Where container living fits</span>
              </div>
              <h2 id="applications-title">Give the space a purpose.</h2>
            </div>
            <div className="application-grid">
              {applications.map(({ title, body, tag, Icon }) => (
                <article className="application-card" key={title}>
                  <Icon size={25} aria-hidden="true" /><span>{tag}</span><h3>{title}</h3><p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="cta-panel" aria-labelledby="cta-title">
            <div className="cta-grid" aria-hidden="true" />
            <div className="cta-copy">
              <span className="section-index">YOUR PROJECT / 08</span>
              <span className="section-label">Ready when you are</span>
              <h2 id="cta-title">Build less ordinary.</h2>
              <p>Tell us how you want to live, work, or house your team. We’ll help turn the right container platform into a finished space with purpose.</p>
              <div className="cta-actions">
                <RedButton href="#consultation">Start a Conversation</RedButton>
                <a className="btn btn-outline" href="tel:8312623222"><Phone size={14} aria-hidden="true" /> (831) 262-3222</a>
              </div>
            </div>
            <div className="cta-benefits">
              <article><CalendarDays size={24} /><span><b>Clear next steps</b><small>From the first conversation</small></span></article>
              <article><Sparkles size={24} /><span><b>Finish options</b><small>Chosen around your use</small></span></article>
              <article><Headphones size={24} /><span><b>Responsive support</b><small>Through build and delivery</small></span></article>
            </div>
          </section>
        </main>

        <footer id="footer" className="footer-panel">
          <div className="footer-top">
            <div className="footer-brand"><Logo small /><p>Texas-built container homes and modular spaces engineered for real life.</p></div>
            <nav aria-label="Footer">
              <h2>Explore</h2><a href="#models">Flagship Model</a><a href="#service-area">Service Area</a><a href="#process">Build Process</a><a href="#craftsmanship">Craftsmanship</a>
            </nav>
            <div className="footer-contact">
              <h2>Start a Project</h2>
              <a href="tel:8312623222"><Phone size={14} /> (831) 262-3222</a>
              <a href="mailto:info@cmaccontainers.com"><Mail size={14} /> info@cmaccontainers.com</a>
            </div>
            <div className="footer-mark"><Package size={23} aria-hidden="true" /><span>Built in Texas</span><small>Delivery available nationwide</small></div>
          </div>
          <div className="footer-bottom"><span>© {new Date().getFullYear()} CMAC Container Homes. All rights reserved.</span><a href="#home">Back to top ↑</a></div>
        </footer>
      </div>
    </>
  )
}
