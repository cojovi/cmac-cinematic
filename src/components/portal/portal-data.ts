import type { LucideIcon } from 'lucide-react'

export type PortalSection = 'overview' | 'sale' | 'inventory' | 'documents' | 'customers'

export type PortalUnit = {
  id: string
  name: string
  subtitle: string
  status: string
  leadTime: string
  image: string
  imageAlt: string
  price: number
  Icon: LucideIcon
}

export type PortalDocument = {
  id: string
  title: string
  detail: string
  group: 'Required' | 'Recommended' | 'Closing'
  selected: boolean
}

export type PortalCustomer = {
  id: string
  name: string
  email: string
  phone: string
  company: string
  location: string
  status: string
  value: number
  lastContact: string
}

export const portalSectionMeta: Record<PortalSection, { breadcrumb: string; title: string }> = {
  overview: { breadcrumb: 'SALES / COMMAND CENTER', title: 'Overview' },
  sale: { breadcrumb: 'SALES / NEW TRANSACTION', title: 'Prepare a sale' },
  inventory: { breadcrumb: 'OPERATIONS / AVAILABLE UNITS', title: 'Inventory' },
  documents: { breadcrumb: 'SALES / TEMPLATE LIBRARY', title: 'Documents' },
  customers: { breadcrumb: 'SALES / CUSTOMER RECORDS', title: 'Customers' },
}

export const mockCustomers: PortalCustomer[] = [
  { id: 'CUS-0204', name: 'Taylor Morgan', email: 'taylor.morgan@example.com', phone: '(512) 555-0184', company: '', location: 'Austin, TX', status: 'Proposal ready', value: 50000, lastContact: 'Today, 9:42 AM' },
  { id: 'CUS-0198', name: 'Avery Brooks', email: 'avery.brooks@example.com', phone: '(225) 555-0137', company: '', location: 'Baton Rouge, LA', status: 'Site review', value: 50000, lastContact: 'Yesterday' },
  { id: 'CUS-0187', name: 'Meridian Workforce LLC', email: 'projects@meridianworkforce.test', phone: '(918) 555-0162', company: 'Meridian Workforce LLC', location: 'Tulsa, OK', status: 'Deposit received', value: 150000, lastContact: 'Aug 3' },
  { id: 'CUS-0179', name: 'Casey & Rowan Ellis', email: 'ellis.project@example.com', phone: '(615) 555-0141', company: '', location: 'Nashville, TN', status: 'New lead', value: 50000, lastContact: 'Aug 1' },
]
