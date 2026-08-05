import { useEffect } from 'react'
import { ArrowLeft, BellRing, CircleDollarSign, FileSignature, PackageCheck } from 'lucide-react'
import { AccessHeader } from '../components/AccessHeader'

const clientFeatures = [
  { title: 'Review & sign', detail: 'Contracts and approvals in one place.', Icon: FileSignature },
  { title: 'Track payments', detail: 'Invoices, deposits, and receipts.', Icon: CircleDollarSign },
  { title: 'Follow the build', detail: 'Milestones from shell to delivery.', Icon: PackageCheck },
]

export default function ClientComingSoonPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  useEffect(() => {
    document.title = 'Client Portal Coming Soon | CMAC Container Homes'
  }, [])

  return (
    <div className="access-page client-soon-page">
      <AccessHeader onNavigate={onNavigate} backLabel="Back to login" backPath="/login" />
      <main className="client-soon-main">
        <div className="client-soon-mark" aria-hidden="true"><BellRing size={34} /></div>
        <span className="portal-eyebrow">02 / Client experience</span>
        <h1>Built for the<br /><span>next handoff.</span></h1>
        <p className="client-soon-lead">The CMAC client portal is coming soon. It will give every buyer a clear view of documents, money, milestones, and delivery.</p>
        <div className="client-feature-grid">
          {clientFeatures.map(({ title, detail, Icon }) => (
            <article key={title}>
              <Icon size={22} aria-hidden="true" />
              <div><h2>{title}</h2><p>{detail}</p></div>
            </article>
          ))}
        </div>
        <button className="portal-secondary-button" type="button" onClick={() => onNavigate('/login')}>
          <ArrowLeft size={16} aria-hidden="true" /> Return to login
        </button>
      </main>
      <footer className="access-footer"><span>CMAC Container Homes</span><span>Client portal / in development</span></footer>
    </div>
  )
}
