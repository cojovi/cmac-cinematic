import { useState, type DragEvent, type ReactNode } from 'react'

export interface KanbanColumn { id: string; label: string; summary?: string; emptyLabel?: string }
export interface KanbanZone { id: string; label: ReactNode; count?: number }

interface KanbanProps<Item> {
  label: string
  columns: KanbanColumn[]
  zones?: KanbanZone[]
  items: Item[]
  getId: (item: Item) => string
  getColumn: (item: Item) => string
  /** Whether this item may be dropped on a column or zone. Controls both drag affordance and drop acceptance. */
  canMove: (item: Item, targetId: string) => boolean
  onMove: (item: Item, targetId: string) => void
  renderCard: (item: Item) => ReactNode
  pendingIds?: Set<string>
  attention?: (item: Item) => boolean
}

/**
 * Drag-and-drop board. Dragging is an enhancement: every card also renders a
 * "Move to" control (supplied by renderCard) so keyboard, touch, and screen
 * reader users can do the same thing.
 */
export function Kanban<Item>({ label, columns, zones = [], items, getId, getColumn, canMove, onMove, renderCard, pendingIds, attention }: KanbanProps<Item>) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const dragged = dragId ? items.find((item) => getId(item) === dragId) : undefined
  const movable = (item: Item) => [...columns, ...zones].some((target) => target.id !== getColumn(item) && canMove(item, target.id))

  function dropProps(targetId: string) {
    const accepts = Boolean(dragged) && getColumn(dragged as Item) !== targetId && canMove(dragged as Item, targetId)
    return {
      onDragOver: (event: DragEvent) => { if (accepts) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (overId !== targetId) setOverId(targetId) } },
      onDragLeave: (event: DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverId((current) => current === targetId ? null : current) },
      onDrop: (event: DragEvent) => {
        event.preventDefault()
        if (accepts && dragged) onMove(dragged, targetId)
        setDragId(null); setOverId(null)
      },
    }
  }

  return (
    <>
      <div className="crm-kanban" role="group" aria-label={label}>
        {columns.map((column) => {
          const cards = items.filter((item) => getColumn(item) === column.id)
          return (
            <section key={column.id} className={overId === column.id ? 'crm-kanban-col drop-target' : 'crm-kanban-col'} aria-label={`${column.label}, ${cards.length} ${cards.length === 1 ? 'record' : 'records'}`} {...dropProps(column.id)}>
              <header><h3>{column.label}</h3><span className="count">{cards.length}</span>{column.summary ? <small>{column.summary}</small> : null}</header>
              <div className="crm-kanban-list">
                {cards.length ? cards.map((item) => {
                  const id = getId(item)
                  const draggable = movable(item) && !pendingIds?.has(id)
                  const className = ['crm-kanban-card', dragId === id ? 'dragging' : '', pendingIds?.has(id) ? 'pending' : '', attention?.(item) ? 'attention' : ''].filter(Boolean).join(' ')
                  return (
                    <article
                      key={id}
                      className={className}
                      draggable={draggable}
                      onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); setDragId(id) }}
                      onDragEnd={() => { setDragId(null); setOverId(null) }}
                    >
                      {renderCard(item)}
                    </article>
                  )
                }) : <div className="crm-kanban-empty">{column.emptyLabel ?? 'Nothing here'}</div>}
              </div>
            </section>
          )
        })}
      </div>
      {zones.length ? (
        <div className="crm-dropzones" aria-hidden={dragged ? undefined : true} style={dragged ? undefined : { display: 'none' }}>
          {zones.map((zone) => <div key={zone.id} className={overId === zone.id ? 'crm-dropzone drop-target' : 'crm-dropzone'} {...dropProps(zone.id)}>{zone.label}</div>)}
        </div>
      ) : null}
    </>
  )
}
