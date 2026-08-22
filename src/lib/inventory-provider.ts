export interface InventoryUnit {
  id: string
  name: string
  subtitle: string
  status: string
  leadTime: string
  image: string
  imageAlt: string
  price: number
  source: 'mock' | 'manual' | 'bolt'
}

export interface InventoryProvider {
  source: InventoryUnit['source']
  getUnits: () => Promise<InventoryUnit[]>
}

const mockUnits: InventoryUnit[] = [
  { id: 'MODEL-LIVING-40', name: 'CMAC Living 40', subtitle: '1 bed / 1 bath / turn-key', status: 'Model reference', leadTime: 'Confirm against Bolt before contract', image: '/minihomes-flagship.png', imageAlt: 'CMAC flagship container home exterior', price: 50000, source: 'mock' },
  { id: 'MODEL-STUDIO-40', name: 'CMAC Studio 40', subtitle: 'Open plan / 1 bath / flex', status: 'Model reference', leadTime: 'Confirm against Bolt before contract', image: '/solutions/custom-spaces.jpg', imageAlt: 'Wood-clad CMAC custom container space', price: 50000, source: 'mock' },
  { id: 'MODEL-CREW-40', name: 'CMAC Crew 40', subtitle: 'Workforce / multi-sleep / durable', status: 'Model reference', leadTime: 'Confirm against Bolt before contract', image: '/solutions/workforce-housing.jpg', imageAlt: 'CMAC workforce container homes in production', price: 50000, source: 'mock' },
]

export const mockInventoryProvider: InventoryProvider = {
  source: 'mock',
  async getUnits() { return mockUnits },
}
