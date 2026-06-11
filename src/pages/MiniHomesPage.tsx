import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Box,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Factory,
  Hammer,
  Headphones,
  LayoutGrid,
  MapPinned,
  Package,
  Phone,
  Shield,
  Truck,
} from 'lucide-react'
import { SiteHeader } from '../components/SiteHeader'
import { IconBox, Logo, RedButton } from '../components/ui'

const trustBadges = [
  { title: 'TEXAS BUILT', detail: 'Built in the Lone Star State', Icon: MapPinned },
  { title: 'FLEXIBLE LAYOUTS', detail: 'Custom to Your Needs', Icon: LayoutGrid },
  { title: 'TURNKEY QUALITY', detail: 'Built to Last', Icon: Shield },
  { title: 'DELIVERY AVAILABLE', detail: 'We Deliver Nationwide', Icon: Truck },
]

const models = [
  {
    title: 'Turn-Key Delivery',
    body: 'Pre-finished interiors with kitchenette, full bath, HVAC, and premium vinyl plank flooring. Arrives ready — not a DIY project.',
    image: '/minihomes-hero.png',
    link: 'Explore Turn-Key',
    Icon: Package,
  },
  {
    title: 'Workforce Housing',
    body: 'Perfect for data center builds, construction crews, and remote site operations across Texas.',
    image: '/Generated image 1.png',
    link: 'Explore Workforce',
    Icon: Building2,
  },
  {
    title: 'Modular Construction',
    body: 'Steel Corten shell, spray-foam insulation, reinforced openings — engineered shelter from the ground up.',
    image: '/hero-bg.jpg',
    link: 'Explore Modular',
    Icon: Factory,
  },
]

const processSteps = [
  { n: '1', title: 'Consult & Design', detail: 'Layout, finishes, and delivery plan.', Icon: ClipboardCheck },
  { n: '2', title: 'Shell & Frame', detail: 'Corten steel reinforced at every opening.', Icon: Box },
  { n: '3', title: 'Systems Rough-In', detail: 'PEX, PVC, wiring before walls close.', Icon: Hammer },
  { n: '4', title: 'Interior Build-Out', detail: 'Insulation, flooring, fixtures, HVAC.', Icon: Building2 },
  { n: '5', title: 'Delivery Ready', detail: 'From shell to move-in in 5 days.', Icon: Truck },
]

const anatomyLayers = [
  { n: '01', title: 'Steel Container Shell', note: 'Corrugated Corten steel foundation.' },
  { n: '02', title: 'Door & Window Framing', note: 'Steel box-tube reinforcement.' },
  { n: '03', title: 'Interior Wood-Stud Framing', note: '2×4 partitions for flexibility.' },
  { n: '04', title: 'Insulation & Vapor Barrier', note: 'High-performance spray foam.' },
  { n: '05', title: 'Electrical & Plumbing', note: 'Rough-in before walls close.' },
  { n: '06', title: 'Subfloor & Vinyl Plank', note: 'Premium water-resistant flooring.' },
]

const specs = [
  { logo: '40ft', title: 'Flagship Model', note: '40ft × 8ft × 8.5ft footprint' },
  { logo: '8ft', title: 'Ceiling Height', note: 'Full standing comfort' },
  { logo: '250', title: 'Miles Included', note: 'First delivery miles on us' },
  { logo: '5', title: 'Day Build Cycle', note: 'Shell to move-in ready' },
  { logo: 'TX', title: 'Texas Built', note: 'Lone Star State quality' },
  { logo: '∞', title: 'Flexible Use', note: 'Homes, offices, workforce' },
]

const galleryShots = [
  {
    stars: '★★★★★',
    quote: '“The container home exceeded expectations — turnkey delivery made the entire process effortless.”',
    name: 'Marcus L.',
    city: 'Austin, TX',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=80&h=80&q=80',
  },
  {
    stars: '★★★★★',
    quote: '“Perfect workforce housing for our data center project. Built fast, built right, delivered on schedule.”',
    name: 'Dana R.',
    city: 'Dallas, TX',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&h=80&q=80',
  },
  {
    stars: '★★★★★',
    quote: '“Texas-built quality you can feel. Flexible layout options made it easy to match our site needs.”',
    name: 'Chris P.',
    city: 'Houston, TX',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=80&h=80&q=80',
  },
]

export default function MiniHomesPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.title = 'CMAC Mini Homes | Container-Built Living & Spaces'
  }, [])

  return (
    <main className="site-shell">
      <SiteHeader variant="minihomes" menuOpen={menuOpen} onMenuToggle={() => setMenuOpen(!menuOpen)} />

      <section className="hero hero-minihomes">
        <div className="minihomes-hero-bg" role="img" aria-label="CMAC container mini home at night with red accent lighting" />
        <div className="hero-copy">
          <h1>
            CMAC
            <br />
            MINI HOMES
          </h1>
          <p className="hero-sub">
            Container-built homes and spaces. Texas-built quality.
            <br />
            Designed for real life.
          </p>
          <p className="hero-body">
            From modern mini homes to offices and flexible spaces, our container solutions are built to last and made
            to fit your lifestyle or business.
          </p>
          <div className="hero-buttons">
            <RedButton href="#consultation">Request Quote</RedButton>
            <a className="btn btn-outline" href="#models">
              Explore Models
            </a>
          </div>
        </div>

        <form id="consultation" className="inspection-card">
          <h2>REQUEST CONSULTATION</h2>
          <p>Fast. Free. No obligation.</p>
          <input aria-label="Full Name" placeholder="Full Name" />
          <input aria-label="Phone Number" placeholder="Phone Number" />
          <input aria-label="Email Address" placeholder="Email Address" />
          <label className="select-like">
            <span>Project Type</span>
            <ChevronDown size={14} />
          </label>
          <input aria-label="Property Address" placeholder="Property Address" />
          <label className="select-like">
            <span>Preferred Date</span>
            <CalendarDays size={14} />
          </label>
          <button type="button">
            Schedule Consultation <ArrowRight size={13} />
          </button>
          <small>We typically respond within 15 minutes.</small>
        </form>

        <div className="trust-row">
          {trustBadges.map(({ title, detail, Icon }) => (
            <div className="trust-item" key={title}>
              <IconBox soft>
                <Icon size={15} />
              </IconBox>
              <span>
                <b>{title}</b>
                <em>{detail}</em>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section id="models" className="panel states-panel minihomes-flagship-panel">
        <div className="minihomes-flagship-art" />
        <div className="states-copy">
          <span className="section-label red">FLAGSHIP MODEL</span>
          <h2>
            40ft Modular
            <br />
            Mini Home
          </h2>
          <ul>
            <li>40ft × 8ft × 8.5ft</li>
            <li>8ft Ceiling Height</li>
            <li>Strong. Adaptable. Mobile.</li>
            <li className="dim">
              First 250 miles delivery
              <br />
              included at launch.
            </li>
          </ul>
        </div>
        <aside className="local-card">
          <IconBox soft>
            <Truck size={20} />
          </IconBox>
          <p>
            Turn-key delivery.
            <br />
            Move-in ready.
            <br />
            Built in Texas.
          </p>
          <a href="#consultation">
            Request Quote <ArrowRight size={11} />
          </a>
        </aside>
      </section>

      <section className="panel services-panel">
        <span className="section-label">WHY CMAC</span>
        <h2>Built to Last. Designed to Impress.</h2>
        <div className="service-grid minihomes-service-grid">
          {models.map(({ title, body, image, link, Icon }) => (
            <article className="service-card" key={title}>
              <img src={image} alt="" />
              <div className="image-vignette" />
              <IconBox soft>
                <Icon size={17} />
              </IconBox>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
                <a href="#consultation">
                  {link} <ArrowRight size={11} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="process" className="panel process-panel">
        <div className="process-title">
          <span className="section-label">OUR PROCESS</span>
          <h2>
            Containers,
            <br />
            Reimagined.
          </h2>
        </div>
        <div className="timeline">
          {processSteps.map(({ n, title, detail, Icon }, index) => (
            <article className={index === 0 ? 'step active-step' : 'step'} key={n}>
              <span className="step-number">{n}</span>
              <span className="step-icon">
                <Icon size={20} />
              </span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel credentials-panel">
        <span className="section-label">ENGINEERED SPECS</span>
        <h2>Compact Living. Serious Build Quality.</h2>
        <div className="credential-grid">
          {specs.map((spec) => (
            <article className="credential-card" key={spec.title}>
              <strong className="minihomes-spec">{spec.logo}</strong>
              <b>{spec.title}</b>
              <span>{spec.note}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="gallery" className="panel anatomy-panel">
        <span className="section-label">UNDER THE CLADDING</span>
        <h2>
          Anatomy of a
          <br />
          Mini-Home
        </h2>
        <p className="anatomy-lead">Twelve engineered layers. One compact living solution. Six core systems below.</p>
        <div className="anatomy-grid">
          {anatomyLayers.map((layer) => (
            <article className="anatomy-card" key={layer.n}>
              <span className="anatomy-number">{layer.n}</span>
              <h3>{layer.title}</h3>
              <p>{layer.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel press-panel minihomes-press-panel">
        <div>
          <span className="section-label">COMING SOON</span>
          <h2>
            The Future of
            <br />
            Compact Living
          </h2>
        </div>
        <div className="press-logos minihomes-launch-logos">
          <span className="minihomes-launch-stat">5</span>
          <span className="minihomes-launch-copy">
            Day Build Cycle
            <small>From shell to move-in ready</small>
          </span>
          <span className="minihomes-launch-domain">cmaccontainers.com</span>
        </div>
      </section>

      <section className="panel reviews-panel">
        <div className="review-title">
          <span className="section-label">EARLY INQUIRIES</span>
          <h2>
            Real Projects.
            <br />
            Real Potential.
          </h2>
        </div>
        <button className="arrow-control left" aria-label="Previous review">
          <ChevronLeft size={15} />
        </button>
        <div className="review-grid">
          {galleryShots.map((review) => (
            <article className="review-card" key={review.name}>
              <strong>{review.stars}</strong>
              <p>{review.quote}</p>
              <div className="review-person">
                <img src={review.avatar} alt="" />
                <span>
                  <b>{review.name}</b>
                  <em>{review.city}</em>
                </span>
              </div>
            </article>
          ))}
        </div>
        <button className="arrow-control right" aria-label="Next review">
          <ChevronRight size={15} />
        </button>
      </section>

      <section className="cta-panel cta-panel-minihomes">
        <div className="cta-fog-layer" aria-hidden="true" />
        <div className="cta-copy">
          <span className="section-label">LAUNCHING SOON</span>
          <h2>
            Be First to
            <br />
            Move In.
          </h2>
          <p>
            Join the waitlist for launch updates, model previews, and early inquiry access. The future of compact living
            is almost here.
          </p>
        </div>
        <div className="benefit-card">
          <article>
            <CalendarDays size={29} />
            <h3>Launch Updates</h3>
            <p>
              Model previews
              <br />
              and availability.
            </p>
          </article>
          <article>
            <Shield size={31} />
            <h3>No Spam</h3>
            <p>
              Just launch news
              <br />
              and early access.
            </p>
          </article>
          <article>
            <Headphones size={31} />
            <h3>Quick Response</h3>
            <p>
              We respond within
              <br />
              15 minutes.
            </p>
          </article>
          <div className="benefit-actions">
            <RedButton wide href="#consultation">
              Notify Me at Launch
            </RedButton>
            <a className="btn btn-outline btn-wide" href="tel:8312623222">
              <Phone size={12} /> (831) 262-3222
            </a>
          </div>
        </div>
      </section>

      <footer id="footer" className="footer-panel">
        <div className="footer-top">
          <Logo small brand="MINI HOMES" to="/mini-homes" />
          <p>Turn-key shipping container mini homes — engineered for living, workforce housing, offices, and flexible spaces.</p>
          <nav>
            <h3>Quick Links</h3>
            <a href="#models">Models</a>
            <a href="#process">Our Process</a>
            <a href="#gallery">Gallery</a>
            <a href="#footer">About Us</a>
          </nav>
          <nav>
            <h3>Resources</h3>
            <a href="#footer">Specifications</a>
            <a href="#footer">Delivery</a>
            <a href="#footer">Financing</a>
            <a href="#footer">FAQ</a>
          </nav>
          <address>
            <h3>Contact</h3>
            <a href="tel:8312623222">(831) 262-3222</a>
            <a href="mailto:info@cmaccontainers.com">info@cmaccontainers.com</a>
            <span>Texas-Built Quality</span>
          </address>
          <div className="socials">
            <h3>Follow Us</h3>
            <span>f</span>
            <span>◎</span>
            <span>▶</span>
            <span>in</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 CMAC Mini Homes. All rights reserved.</span>
          <span>
            <a href="#footer">Privacy Policy</a>
            <a href="#footer">Terms of Service</a>
          </span>
        </div>
      </footer>
    </main>
  )
}
