import { describe, expect, it } from 'vitest'
import { averageEnergy, byCategory, costPerKm, energyIntervals, filterRecords, totalCents } from './calculations'
import type { ExpenseRecord, Vehicle } from './models'

const vehicle: Vehicle = { id: 'v1', name: '车', energyType: 'fuel', initialMileage: 1000, isDefault: true, createdAt: '', updatedAt: '' }
const record = (id: string, extra: Partial<ExpenseRecord>): ExpenseRecord => ({ id, vehicleId: 'v1', category: 'parking', amountCents: 1000, occurredAt: '2026-08-01T10:00', excludedFromEnergy: false, createdAt: '', updatedAt: '', ...extra })

describe('calculations', () => {
  it('filters and aggregates records', () => {
    const records = [record('a', { category: 'parking', amountCents: 2000, notes: '机场' }), record('b', { category: 'wash', amountCents: 500, notes: '小区' })]
    expect(filterRecords(records, { query: '机场' }).map(item => item.id)).toEqual(['a'])
    expect(totalCents(records)).toBe(2500)
    expect(byCategory(records)).toEqual([['parking', 2000], ['wash', 500]])
    expect(filterRecords(records, { start: '2026-08-01', end: '2026-08-01', minCents: 1000, maxCents: 2000 }).map(item => item.id)).toEqual(['a'])
  })

  it('calculates cost per kilometre only when mileage is sufficient', () => {
    expect(costPerKm(vehicle, [record('a', { mileage: 1100 }), record('b', { mileage: 1200, amountCents: 2000 })])).toBe(15)
    expect(costPerKm(vehicle, [record('a', { mileage: 1100 })])).toBeUndefined()
  })

  it('calculates energy intervals and ignores excluded or reversed readings', () => {
    const records = [record('a', { category: 'fuel', mileage: 1000, fuelLiters: 20 }), record('b', { category: 'fuel', mileage: 1200, fuelLiters: 16, amountCents: 12000 }), record('c', { category: 'fuel', mileage: 1100, fuelLiters: 10, excludedFromEnergy: true })]
    const intervals = energyIntervals(records, 'fuel')
    expect(intervals).toHaveLength(1)
    expect(intervals[0].consumption).toBe(8)
    expect(averageEnergy(intervals)).toBe(8)
  })
})
