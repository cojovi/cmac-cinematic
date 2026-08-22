import type { LucideIcon } from 'lucide-react'
import { BriefcaseBusiness, ClipboardCheck, FileSignature, ReceiptText, UsersRound, BookOpenCheck } from 'lucide-react'

export type ResourceName = 'leads' | 'customers' | 'tasks' | 'deals' | 'quotes' | 'contracts'

export interface ResourceConfig {
  table: string
  title: string
  eyebrow: string
  copy: string
  emptyTitle: string
  emptyCopy: string
  Icon: LucideIcon
  select: string
  orderBy: string
  detailPath?: string
}

export const resourceConfigs: Record<ResourceName, ResourceConfig> = {
  leads: { table: 'leads', title: 'Lead pipeline', eyebrow: 'CRM / INQUIRIES', copy: 'Search, qualify, and follow every assigned opportunity.', emptyTitle: 'No assigned leads', emptyCopy: 'New website inquiries will appear here after secure assignment.', Icon: BriefcaseBusiness, select: '*,contacts(display_name,email,phone)', orderBy: 'created_at', detailPath: '/employee-portal/leads' },
  customers: { table: 'contacts', title: 'Contacts & customers', eyebrow: 'CRM / CANONICAL CONTACTS', copy: 'One case-insensitive contact record connects every lead, deal, quote, and contract.', emptyTitle: 'No contact records', emptyCopy: 'Contacts appear after a public inquiry or an authorized employee creates one.', Icon: UsersRound, select: '*', orderBy: 'updated_at', detailPath: '/employee-portal/customers' },
  tasks: { table: 'tasks', title: 'Follow-up queue', eyebrow: 'TASKS / DUE DATES', copy: 'Overdue, due today, and upcoming work in one focused list.', emptyTitle: 'Your queue is clear', emptyCopy: 'Create a follow-up from a lead, contact, or deal record.', Icon: ClipboardCheck, select: '*,contacts(display_name)', orderBy: 'due_at' },
  deals: { table: 'deals', title: 'Deal workspace', eyebrow: 'SALES / TRANSACTIONS', copy: 'The central record connecting the customer, unit, commercial terms, and contract.', emptyTitle: 'No deals yet', emptyCopy: 'Save the New Sale wizard to create your first deal draft.', Icon: BookOpenCheck, select: '*,contacts(display_name,email)', orderBy: 'updated_at', detailPath: '/employee-portal/deals' },
  quotes: { table: 'quotes', title: 'Quote records', eyebrow: 'COMMERCIALS / ITEMIZED TOTALS', copy: 'Maintain itemized pricing and clearly labeled external status updates.', emptyTitle: 'No quotes yet', emptyCopy: 'Create a quote from an existing deal draft.', Icon: ReceiptText, select: '*,contacts(display_name)', orderBy: 'updated_at' },
  contracts: { table: 'contracts', title: 'Contract tracking', eyebrow: 'CONTRACTS / COMING SOON', copy: 'Review the contract roadmap and any retained records while DocuSign delivery remains paused.', emptyTitle: 'No contracts yet', emptyCopy: 'DocuSign envelope creation will arrive in a later iteration.', Icon: FileSignature, select: '*,contacts(display_name)', orderBy: 'updated_at' },
}

export function nestedLabel(row: Record<string, unknown>, key = 'contacts') {
  const nested = row[key]
  if (!nested || typeof nested !== 'object') return ''
  const record = nested as Record<string, unknown>
  return String(record.display_name ?? record.email ?? '')
}
