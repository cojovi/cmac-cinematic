import { useEffect, useState } from 'react'
import { ArrowRight, Boxes, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import InventoryHeadline from '../../components/portal/InventoryHeadline'
import { mockInventoryProvider, type InventoryUnit } from '../../lib/inventory-provider'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function InventoryPage() {
  const [units, setUnits] = useState<InventoryUnit[]>([])
  useEffect(() => { void mockInventoryProvider.getUnits().then(setUnits) }, [])
  return <section className="portal-library-view" aria-labelledby="inventory-heading">
    <div className="workspace-view-heading"><div><span>INVENTORY / LIVE AGGREGATE + MODEL REFERENCES</span><h2 id="inventory-heading">Availability & model selection</h2><p>The headline is authoritative Bolt-Data inventory. Individual cards are clearly isolated model references until a stable unit feed exists.</p></div></div>
    <InventoryHeadline />
    <div className="configuration-state inventory-contract-note"><ShieldCheck size={18} /><div><strong>Contracts require a confirmed real unit ID</strong><span>Model references can start a draft, but cannot be sent through DocuSign or marked sold until replaced with a confirmed manual or Bolt unit reference.</span></div></div>
    <div className="inventory-model-grid">
      {units.map((unit) => <article key={unit.id} className="inventory-model-card"><div><img src={unit.image} alt={unit.imageAlt} /><span>MODEL REFERENCE / MOCK</span></div><section><small>{unit.id}</small><h3>{unit.name}</h3><p>{unit.subtitle}</p><dl><div><dt>Planning price</dt><dd>{money.format(unit.price)}</dd></div><div><dt>Sale readiness</dt><dd>{unit.leadTime}</dd></div></dl><Link className="portal-primary-button" to={`/employee-portal/sales/new?model=${encodeURIComponent(unit.id)}`}>Start draft <ArrowRight size={15} /></Link></section></article>)}
    </div>
    <div className="inventory-provider-footnote"><Boxes size={17} /><span>Per-unit source: <strong>{mockInventoryProvider.source}</strong>. No raw Bolt tables, customer data, or replicated counting logic are used.</span></div>
  </section>
}
