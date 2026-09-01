import { describe, expect, it } from 'vitest'
import { averageEnergy, byCategory, costPerKm, energyDateRange, energyIntervals, energyQuality, energySummary, energyUnitPriceCents, filterEnergyIntervals, filterRecords, hybridEnergyCost, monthSummary, monthlyCostPerKm, monthlyTrend, totalCents } from './calculations'
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

  it('builds dashboard month summaries and avoids misleading monthly per-kilometre costs', () => {
    const records = [
      record('july', { occurredAt: '2026-07-15T10:00', amountCents: 3000, mileage: 1100 }),
      record('aug-a', { occurredAt: '2026-08-02T10:00', amountCents: 2000, mileage: 1200 }),
      record('aug-b', { occurredAt: '2026-08-20T10:00', amountCents: 5000, mileage: 1400 }),
    ]
    expect(monthSummary(records, '2026-08')).toMatchObject({ totalCents: 7000, count: 2, averageCents: 3500, changePercent: 133.333 })
    expect(monthlyTrend(records, '2026-08', 3)).toEqual([
      { month: '2026-06', totalCents: 0 },
      { month: '2026-07', totalCents: 3000 },
      { month: '2026-08', totalCents: 7000 },
    ])
    expect(monthlyCostPerKm(records, '2026-08')).toEqual({ costCents: 7000, distance: 200, costPerKm: 35 })
    expect(monthlyCostPerKm([records[1]], '2026-08')).toEqual({ reason: '至少需要两条含里程记录。' })
  })
  it('builds a full-to-full fuel interval and accumulates partial refuels', () => {
    const records = [
      record('a', { category: 'fuel', occurredAt: '2026-08-01T10:00', mileage: 1000, fuelLiters: 50, amountCents: 25000, isFullFuel: true }),
      record('b', { category: 'fuel', occurredAt: '2026-08-10T10:00', mileage: 1200, fuelLiters: 20, amountCents: 10000, isFullFuel: false }),
      record('c', { category: 'fuel', occurredAt: '2026-08-20T10:00', mileage: 1500, fuelLiters: 25, amountCents: 12500, isFullFuel: true }),
    ]
    const intervals = energyIntervals(records, 'fuel')
    expect(intervals).toHaveLength(1)
    expect(intervals[0]).toMatchObject({ distance: 500, quantity: 45, costCents: 22500, consumption: 9, costPerKm: 45 })
    expect(intervals[0].records.map(item => item.id)).toEqual(['b', 'c'])
    expect(averageEnergy(intervals)).toBe(9)
  })

  it('builds full-charge intervals and ignores excluded or reversed records', () => {
    const records = [
      record('a', { category: 'charge', occurredAt: '2026-08-01T10:00', mileage: 1000, chargeKwh: 30, amountCents: 3000, isFullCharge: true }),
      record('excluded', { category: 'charge', occurredAt: '2026-08-05T10:00', mileage: 1100, chargeKwh: 10, amountCents: 1000, excludedFromEnergy: true }),
      record('b', { category: 'charge', occurredAt: '2026-08-10T10:00', mileage: 1200, chargeKwh: 24, amountCents: 2400, isFullCharge: true }),
      record('reversed', { category: 'charge', occurredAt: '2026-08-20T10:00', mileage: 1150, chargeKwh: 20, amountCents: 2000, isFullCharge: true }),
    ]
    const intervals = energyIntervals(records, 'charge')
    expect(intervals).toHaveLength(1)
    expect(intervals[0]).toMatchObject({ distance: 200, quantity: 24, costCents: 2400, consumption: 12, costPerKm: 12 })
    expect(intervals[0].records.map(item => item.id)).toEqual(['b'])
  })

  it('does not produce energy intervals without two complete boundaries', () => {
    const records = [
      record('a', { category: 'fuel', mileage: 1000, fuelLiters: 20, isFullFuel: true }),
      record('b', { category: 'fuel', mileage: 1200, fuelLiters: 16, isFullFuel: false }),
    ]
    expect(energyIntervals(records, 'fuel')).toEqual([])
  })

  it('filters intervals by their ending date while retaining an earlier calculation baseline', () => {
    const records = [
      record('a', { category: 'fuel', occurredAt: '2026-07-01T10:00', mileage: 1000, fuelLiters: 40, isFullFuel: true }),
      record('b', { category: 'fuel', occurredAt: '2026-08-10T10:00', mileage: 1400, fuelLiters: 32, isFullFuel: true }),
      record('c', { category: 'fuel', occurredAt: '2026-09-10T10:00', mileage: 1800, fuelLiters: 36, isFullFuel: true }),
    ]
    const filtered = filterEnergyIntervals(energyIntervals(records, 'fuel'), { start: '2026-08-01', end: '2026-08-31' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].from.id).toBe('a')
    expect(filtered[0].to.id).toBe('b')
    expect(energyDateRange('twelve', new Date(2026, 7, 31, 12))).toEqual({ start: '2025-08-31', end: '2026-08-31' })
    expect(energyDateRange('custom', new Date(2026, 7, 31, 12), '2026-01-02', '2026-03-04')).toEqual({ start: '2026-01-02', end: '2026-03-04' })
  })

  it('summarizes energy with weighted averages, recent change, totals and price fallback', () => {
    const records = [
      record('a', { category: 'fuel', occurredAt: '2026-08-01T10:00', mileage: 1000, fuelLiters: 50, amountCents: 25000, isFullFuel: true }),
      record('b', { category: 'fuel', occurredAt: '2026-08-10T10:00', mileage: 1500, fuelLiters: 45, amountCents: 22500, isFullFuel: true }),
      record('c', { category: 'fuel', occurredAt: '2026-08-20T10:00', mileage: 1800, fuelLiters: 30, amountCents: 18000, isFullFuel: true }),
    ]
    expect(energySummary(energyIntervals(records, 'fuel'))).toMatchObject({ average: 9.375, recent: 10, distance: 800, quantity: 75, costCents: 40500, costPerKm: 50.625, averageUnitPriceCents: 540 })
    expect(energySummary(energyIntervals(records, 'fuel')).changePercent).toBeCloseTo(11.111, 2)
    expect(energyUnitPriceCents(record('price', { category: 'fuel', fuelLiters: 20, amountCents: 10000 }), 'fuel')).toBe(500)
    expect(energyUnitPriceCents(record('explicit', { category: 'fuel', fuelLiters: 20, amountCents: 10000, unitPriceCents: 600 }), 'fuel')).toBe(600)
  })

  it('calculates hybrid energy cost over one odometer span without combining consumption units', () => {
    const fuel = energyIntervals([
      record('f1', { category: 'fuel', occurredAt: '2026-08-01T10:00', mileage: 1000, fuelLiters: 40, isFullFuel: true }),
      record('f2', { category: 'fuel', occurredAt: '2026-08-15T10:00', mileage: 1500, fuelLiters: 40, amountCents: 20000, isFullFuel: true }),
    ], 'fuel')
    const charge = energyIntervals([
      record('c1', { category: 'charge', occurredAt: '2026-08-02T10:00', mileage: 1100, chargeKwh: 30, isFullCharge: true }),
      record('c2', { category: 'charge', occurredAt: '2026-08-20T10:00', mileage: 1600, chargeKwh: 50, amountCents: 5000, isFullCharge: true }),
    ], 'charge')
    expect(hybridEnergyCost(fuel, charge)).toEqual({ distance: 600, costCents: 25000, costPerKm: 25000 / 600 })
  })
  it('reports energy data quality without treating excluded records as active errors', () => {
    const records = [
      record('start', { category: 'fuel', occurredAt: '2026-08-01T10:00', mileage: 1000, fuelLiters: 40, isFullFuel: true }),
      record('partial', { category: 'fuel', occurredAt: '2026-08-02T10:00', fuelLiters: 10, isFullFuel: false }),
      record('reversed', { category: 'fuel', occurredAt: '2026-08-03T10:00', mileage: 900, fuelLiters: 20, isFullFuel: true }),
      record('missing-quantity', { category: 'fuel', occurredAt: '2026-08-04T10:00', mileage: 1100, isFullFuel: true }),
      record('excluded', { category: 'fuel', occurredAt: '2026-08-05T10:00', excludedFromEnergy: true }),
    ]
    expect(energyQuality(records, 'fuel')).toEqual({ total: 5, completeIntervals: 0, missingMileage: 1, missingQuantity: 1, unmarkedFull: 1, reversedMileage: 1, excluded: 1 })
  })
})
