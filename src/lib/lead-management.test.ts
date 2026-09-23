import { describe, expect, it } from 'vitest'
import { leadAssigneeOptions } from './lead-management'

describe('manual lead assignees', () => {
  it('includes active administrators and salespeople with clear role labels', () => {
    expect(leadAssigneeOptions([
      { id: 'rep', display_name: 'Zoe Sales', rep_code: 'CMAC-0002', role: 'sales_rep', active: true },
      { id: 'admin', display_name: 'Alex Admin', rep_code: 'CMAC-0001', role: 'admin', active: true },
    ])).toEqual([
      { id: 'admin', displayName: 'Alex Admin', repCode: 'CMAC-0001', roleLabel: 'Administrator' },
      { id: 'rep', displayName: 'Zoe Sales', repCode: 'CMAC-0002', roleLabel: 'Salesperson' },
    ])
  })

  it('excludes inactive employees and unrecognized roles', () => {
    expect(leadAssigneeOptions([
      { id: 'inactive-admin', role: 'admin', active: false },
      { id: 'inactive-rep', role: 'sales_rep', active: false },
      { id: 'unknown', role: 'other', active: true },
      { id: 'missing-active', role: 'admin' },
    ])).toEqual([])
  })
})
