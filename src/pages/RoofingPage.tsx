import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Award,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  DoorClosed,
  Hammer,
  Headphones,
  Home,
  MapPinned,
  Phone,
  Search,
  Shield,
  Star,
  Wrench,
} from 'lucide-react'
import { SiteHeader } from '../components/SiteHeader'
import { IconBox, Logo, RedButton } from '../components/ui'

const trustBadges = [
  { title: 'VETERAN OWNED', detail: 'U.S. Veteran Operated', Icon: Award },
  { title: '5 STAR RATED', detail: '1,000+ Reviews', Icon: Star },
  { title: 'INSURED & BONDED', detail: 'Fully Licensed', Icon: Shield },
  { title: '24/7 RESPONSE', detail: 'Storm & Emergency', Icon: Home },
]

const services = [
  {
    title: 'Roofing',
    body: 'Shingle, metal, tile, and flat roof systems installed with precision.',
    image: '/svc-roofing-clean.jpg',
    link: 'Explore Roofing',
    Icon: Home,
  },
  {
    title: 'Gutters',
    body: 'Custom gutter systems designed to protect your foundation.',
    image: '/svc-gutters-clean.jpg',
    link: 'Explore Gutters',
    Icon: CircleDot,
  },
  {
    title: 'Doors',
    body: 'Front entry, patio, and storm doors that add security and style.',
    image: '/svc-doors-clean.jpg',
    link: 'Explore Doors',
    Icon: DoorClosed,
  },
  {
    title: 'Restoration',
    body: 'Storm damage, insurance claims, and full-service restoration support.',
    image: '/svc-restoration-clean.jpg',
    link: 'Explore Restoration',
    Icon: Wrench,
  },
]

const processSteps = [
  { n: '1', title: 'Schedule Inspection', detail: 'We make it easy to get started.', Icon: CalendarDays },
  { n: '2', title: 'Inspect & Assess', detail: 'Advanced tools. Expert assessment.', Icon: Search },
  { n: '3', title: 'Plan & Approve', detail: 'Transparent scope. Detailed proposal.', Icon: ClipboardCheck },
  { n: '4', title: 'Build & Execute', detail: 'Quality crews. On-time delivery.', Icon: Hammer },
  { n: '5', title: 'Final Inspection', detail: "We don't leave until it's perfect.", Icon: Shield },
]

const credentials = [
  { logo: 'GAF', title: 'Master Elite®', note: 'Certified Contractor', className: 'gaf' },
  { logo: 'CertainTeed', title: 'SELECT', note: 'ShingleMaster™', className: 'certainteed' },
  { logo: 'IKO', title: 'ROOFPRO', note: 'Preferred Contractor', className: 'iko' },
  { logo: 'Malarkey', title: 'CERTIFIED', note: 'Residential Contractor', className: 'malarkey' },
  { logo: 'Owens Corning', title: 'PREFERRED', note: 'Contractor', className: 'owens' },
  { logo: 'BBB', title: 'A+ Rating', note: 'Accredited Business', className: 'bbb' },
]

const reviews = [
  {
    stars: '★★★★★',
    quote: '“CMAC Roofing was fast, professional, and the quality is second to none. Highly recommend!”',
    name: 'Jason M.',
    city: 'Tulsa, OK',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&h=80&q=80',
  },
  {
    stars: '★★★★★',
    quote: "“They handled our storm damage claim start to finish. Couldn't have asked for a better experience.”",
    name: 'Sarah T.',
    city: 'Nashville, TN',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80',
  },
  {
    stars: '★★★★★',
    quote: '“Veteran owned and it shows. Integrity, communication, and craftsmanship all the way.”',
    name: 'Robert K.',
    city: 'Dallas, TX',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&h=80&q=80',
  },
]

export default function RoofingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.title = 'CMAC Roofing | Veteran-Owned Exterior & Restoration'
  }, [])

  return (
    <main className="site-shell">
      <SiteHeader variant="roofing" menuOpen={menuOpen} onMenuToggle={() => setMenuOpen(!menuOpen)} />

      <section className="hero">
        <div className="blueprint-grid" />
        <div className="hero-house" />
        <div className="hero-copy">
          <h1>
            CMAC
            <br />
            ROOFING
          </h1>
          <p className="hero-sub">
            Veteran-owned. Mission-focused.
            <br />
            Protecting what matters across 6 states.
          </p>
          <p className="hero-body">
            Roofing, gutters, doors, and restoration built to endure—backed by discipline, integrity, and unmatched
            quality.
          </p>
          <div className="hero-buttons">
            <RedButton>Request Inspection</RedButton>
            <a className="btn btn-outline" href="#services">
              Explore Services
            </a>
          </div>
        </div>

        <form id="inspection" className="inspection-card">
          <h2>REQUEST INSPECTION</h2>
          <p>Fast. Free. No obligation.</p>
          <input aria-label="Full Name" placeholder="Full Name" />
          <input aria-label="Phone Number" placeholder="Phone Number" />
          <input aria-label="Email Address" placeholder="Email Address" />
          <label className="select-like">
            <span>Service Needed</span>
            <ChevronDown size={14} />
          </label>
          <input aria-label="Property Address" placeholder="Property Address" />
          <label className="select-like">
            <span>Preferred Date</span>
            <CalendarDays size={14} />
          </label>
          <button type="button">
            Schedule Inspection <ArrowRight size={13} />
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

      <section id="states" className="panel states-panel">
        <div className="states-art" />
        <div className="states-copy">
          <span className="section-label red">SYSTEM STATUS</span>
          <h2>
            Proudly Serving
            <br />6 States
          </h2>
          <ul>
            <li>Texas</li>
            <li>Tennessee</li>
            <li>Oklahoma</li>
            <li>Georgia</li>
            <li>Arkansas</li>
            <li className="dim">
              Expanding to serve
              <br />
              more communities.
            </li>
          </ul>
        </div>
        <aside className="local-card">
          <IconBox soft>
            <MapPinned size={20} />
          </IconBox>
          <p>
            Local teams.
            <br />
            Rapid response.
            <br />
            Built for your region.
          </p>
          <a href="#footer">
            View All Locations <ArrowRight size={11} />
          </a>
        </aside>
      </section>

      <section id="services" className="panel services-panel">
        <span className="section-label">OUR SERVICE SYSTEM</span>
        <h2>Complete Exterior. Total Protection.</h2>
        <div className="service-grid">
          {services.map(({ title, body, image, link, Icon }) => (
            <article className="service-card" key={title}>
              <img src={image} alt="" />
              <div className="image-vignette" />
              <IconBox soft>
                <Icon size={17} />
              </IconBox>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
                <a href="#inspection">
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
            Built on a
            <br />
            Disciplined Process
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
        <span className="section-label">CERTIFIED. TRUSTED. PROVEN.</span>
        <h2>Credentials You Can Count On.</h2>
        <div className="credential-grid">
          {credentials.map((credential) => (
            <article className="credential-card" key={credential.logo}>
              <strong className={credential.className}>{credential.logo}</strong>
              <b>{credential.title}</b>
              <span>{credential.note}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel press-panel">
        <div>
          <span className="section-label">AS SEEN IN</span>
          <h2>
            Recognized for
            <br />
            Excellence
          </h2>
        </div>
        <div className="press-logos">
          <span className="forbes">Forbes</span>
          <span className="entrepreneur">Entrepreneur</span>
          <span className="inc">Inc.</span>
          <span className="roofing-logo">
            ROOFING
            <br />
            CONTRACTOR
          </span>
          <span className="yahoo">
            yahoo!<small>finance</small>
          </span>
        </div>
      </section>

      <section className="panel reviews-panel">
        <div className="review-title">
          <span className="section-label">WHAT OUR CLIENTS SAY</span>
          <h2>
            Real Reviews.
            <br />
            Real Results.
          </h2>
        </div>
        <button className="arrow-control left" aria-label="Previous review">
          <ChevronLeft size={15} />
        </button>
        <div className="review-grid">
          {reviews.map((review) => (
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

      <section className="cta-panel">
        <div className="cta-fog-layer" aria-hidden="true" />
        <div className="cta-copy">
          <span className="section-label">READY FOR PEACE OF MIND?</span>
          <h2>
            Let’s Protect
            <br />
            What Matters.
          </h2>
          <p>Get a free inspection and expert recommendation from a team that treats your property like our own.</p>
        </div>
        <div className="benefit-card">
          <article>
            <CalendarDays size={29} />
            <h3>Fast Scheduling</h3>
            <p>
              Book online in
              <br />
              60 seconds.
            </p>
          </article>
          <article>
            <Shield size={31} />
            <h3>No Obligation</h3>
            <p>
              Free inspection
              <br />& honest answers.
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
            <RedButton wide>Request Inspection</RedButton>
            <a className="btn btn-outline btn-wide" href="tel:8332623222">
              <Phone size={12} /> (833) 262-3222
            </a>
          </div>
        </div>
      </section>

      <footer id="footer" className="footer-panel">
        <div className="footer-top">
          <Logo small />
          <p>Veteran-owned roofing, gutters, doors, and restoration services across 6 states.</p>
          <nav>
            <h3>Quick Links</h3>
            <a href="#services">Services</a>
            <a href="#process">Our Process</a>
            <a href="#states">Locations</a>
            <a href="#footer">About Us</a>
          </nav>
          <nav>
            <h3>Resources</h3>
            <a href="#footer">Financing</a>
            <a href="#footer">Warranty</a>
            <a href="#footer">Insurance Claims</a>
            <a href="#footer">Blog</a>
          </nav>
          <address>
            <h3>Contact</h3>
            <a href="tel:8332623222">(833) 262-3222</a>
            <a href="mailto:info@cmacroofing.com">info@cmacroofing.com</a>
            <span>24/7 Emergency Service</span>
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
          <span>© 2025 CMAC Roofing. All rights reserved.</span>
          <span>
            <a href="#footer">Privacy Policy</a>
            <a href="#footer">Terms of Service</a>
          </span>
        </div>
      </footer>
    </main>
  )
}
