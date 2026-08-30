import type { ExpenseCategory, ExpenseRecord, Vehicle } from './models'

export interface RecordFilters { vehicleId?: string; category?: ExpenseCategory; start?: string; end?: string; minCents?: number; maxCents?: number; query?: string }

export function filterRecords(records: ExpenseRecord[], filters: RecordFilters = {}) {
  const query = filters.query?.trim().toLowerCase()
  return records.filter(record =>
    (!filters.vehicleId || record.vehicleId === filters.vehicleId) &&
    (!filters.category || record.category === filters.category) &&
    (!filters.start || record.occurredAt >= filters.start) &&
    (!filters.end || record.occurredAt <= `${filters.end}T23:59`) &&
    (filters.minCents === undefined || record.amountCents >= filters.minCents) &&
    (filters.maxCents === undefined || record.amountCents <= filters.maxCents) &&
    (!query || [record.merchantOrLocation, record.notes].filter(Boolean).join(' ').toLowerCase().includes(query)),
  )
}

export const totalCents = (records: ExpenseRecord[]) => records.reduce((sum, record) => sum + record.amountCents, 0)
export const byCategory = (records: ExpenseRecord[]) => Object.entries(records.reduce<Record<string, number>>((all, record) => ({ ...all, [record.category]: (all[record.category] ?? 0) + record.amountCents }), {})).sort((a, b) => b[1] - a[1])
export const monthKey = (value: string) => value.slice(0, 7)
export const byMonth = (records: ExpenseRecord[]) => Object.entries(records.reduce<Record<string, number>>((all, record) => ({ ...all, [monthKey(record.occurredAt)]: (all[monthKey(record.occurredAt)] ?? 0) + record.amountCents }), {})).sort(([a], [b]) => a.localeCompare(b))

export const highestMileage = (vehicle: Vehicle, records: ExpenseRecord[]) => Math.max(vehicle.initialMileage, ...records.filter(record => record.mileage !== undefined).map(record => record.mileage!))
export function costPerKm(vehicle: Vehicle, records: ExpenseRecord[]) {
  const mileages = records.flatMap(record => record.mileage === undefined ? [] : [record.mileage])
  if (mileages.length < 2) return undefined
  const distance = Math.max(...mileages) - Math.min(vehicle.initialMileage, ...mileages)
  return distance > 0 ? totalCents(records) / distance : undefined
}

export interface EnergyInterval { from: ExpenseRecord; to: ExpenseRecord; distance: number; quantity: number; consumption: number; costPerKm: number }
export function energyIntervals(records: ExpenseRecord[], category: 'fuel' | 'charge') {
  const valid = records.filter(record => record.category === category && !record.excludedFromEnergy && record.mileage !== undefined && (category === 'fuel' ? (record.fuelLiters ?? 0) > 0 : (record.chargeKwh ?? 0) > 0)).sort((a, b) => a.mileage! - b.mileage!)
  const result: EnergyInterval[] = []
  for (let index = 1; index < valid.length; index += 1) {
    const from = valid[index - 1], to = valid[index], distance = to.mileage! - from.mileage!, quantity = category === 'fuel' ? to.fuelLiters! : to.chargeKwh!
    if (distance > 0) result.push({ from, to, distance, quantity, consumption: quantity / distance * 100, costPerKm: to.amountCents / distance })
  }
  return result
}
export function averageEnergy(intervals: EnergyInterval[]) {
  const distance = intervals.reduce((sum, item) => sum + item.distance, 0)
  return distance ? intervals.reduce((sum, item) => sum + item.quantity, 0) / distance * 100 : undefined
}
