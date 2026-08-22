import { AlertTriangle, Boxes, Clock3, LoaderCircle, RefreshCw, ServerOff } from 'lucide-react'
import { useInventorySummary } from '../../hooks/useInventorySummary'

const syncTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export default function InventoryHeadline({ compact = false }: { compact?: boolean }) {
  const { data, loading, error, stale, retry } = useInventorySummary()
  if (loading) return <article className={`inventory-headline ${compact ? 'compact' : ''}`} aria-live="polite"><LoaderCircle className="spin" /><div><span>BOLT-DATA / LIVE COUNT</span><strong>Loading inventory</strong><small>Checking the protected aggregate view.</small></div></article>
  if (error) return <article className={`inventory-headline unavailable ${compact ? 'compact' : ''}`} role="status"><ServerOff /><div><span>BOLT-DATA / {error.code.replace('_', ' ')}</span><strong>Inventory unavailable</strong><small>{error.message}</small></div>{error.code !== 'not_configured' ? <button type="button" onClick={() => void retry()} aria-label="Retry inventory"><RefreshCw size={15} /></button> : null}</article>
  if (!data) return null
  return <article className={`inventory-headline ${stale ? 'stale' : ''} ${compact ? 'compact' : ''}`}><Boxes /><div><span>BOLT-DATA / LIVE COUNT</span><strong><b>{data.available_inventory}</b> available mini homes</strong><small>{data.allocated_boss} allocated to Boss · As of {syncTime.format(new Date(data.last_synced_at))}</small></div>{stale ? <span className="inventory-stale"><AlertTriangle size={14} /> Data is over one hour old</span> : <span className="inventory-fresh"><Clock3 size={14} /> Synced</span>}</article>
}
