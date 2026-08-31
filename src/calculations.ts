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

export interface EnergyInterval { from: ExpenseRecord; to: ExpenseRecord; records: ExpenseRecord[]; distance: number; quantity: number; costCents: number; consumption: number; costPerKm: number }
export function energyIntervals(records: ExpenseRecord[], category: 'fuel' | 'charge') {
  const quantityOf = (record: ExpenseRecord) => category === 'fuel' ? record.fuelLiters ?? 0 : record.chargeKwh ?? 0
  const isFull = (record: ExpenseRecord) => category === 'fuel' ? record.isFullFuel : record.isFullCharge
  const relevant = records.filter(record => record.category === category && !record.excludedFromEnergy && quantityOf(record) > 0).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const result: EnergyInterval[] = []
  let from: ExpenseRecord | undefined, included: ExpenseRecord[] = []
  for (const record of relevant) {
    if (!from) {
      if (isFull(record) && record.mileage !== undefined) from = record
      continue
    }
    if (record.mileage !== undefined && record.mileage <= from.mileage!) continue
    included.push(record)
    if (isFull(record) && record.mileage !== undefined) {
      const distance = record.mileage - from.mileage!, quantity = included.reduce((sum, item) => sum + quantityOf(item), 0), costCents = included.reduce((sum, item) => sum + item.amountCents, 0)
      result.push({ from, to: record, records: included, distance, quantity, costCents, consumption: quantity / distance * 100, costPerKm: costCents / distance })
      from = record
      included = []
    }
  }
  return result
}
export function averageEnergy(intervals: EnergyInterval[]) {
  const distance = intervals.reduce((sum, item) => sum + item.distance, 0)
  return distance ? intervals.reduce((sum, item) => sum + item.quantity, 0) / distance * 100 : undefined
}

export type EnergyRangePreset = 'three' | 'six' | 'twelve' | 'all' | 'custom'
export interface EnergyDateRange { start?: string; end?: string }
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function energyDateRange(preset: EnergyRangePreset, now = new Date(), customStart = '', customEnd = ''): EnergyDateRange {
  if (preset === 'all') return {}
  if (preset === 'custom') return { start: customStart || undefined, end: customEnd || undefined }
  const months = preset === 'three' ? 3 : preset === 'six' ? 6 : 12
  const start = new Date(now.getFullYear(), now.getMonth() - months, 1)
  start.setDate(Math.min(now.getDate(), new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()))
  return { start: localDate(start), end: localDate(now) }
}

export function filterEnergyIntervals(intervals: EnergyInterval[], range: EnergyDateRange) {
  return intervals.filter(interval => (!range.start || interval.to.occurredAt.slice(0, 10) >= range.start) && (!range.end || interval.to.occurredAt.slice(0, 10) <= range.end))
}

export function energyUnitPriceCents(record: ExpenseRecord, category: 'fuel' | 'charge') {
  if (record.unitPriceCents !== undefined) return record.unitPriceCents
  const quantity = category === 'fuel' ? record.fuelLiters : record.chargeKwh
  return quantity && quantity > 0 ? record.amountCents / quantity : undefined
}

export function energySummary(intervals: EnergyInterval[]) {
  const distance = intervals.reduce((sum, item) => sum + item.distance, 0), quantity = intervals.reduce((sum, item) => sum + item.quantity, 0), costCents = intervals.reduce((sum, item) => sum + item.costCents, 0)
  const recent = intervals.at(-1)?.consumption, previous = intervals.at(-2)?.consumption
  return { average: distance ? quantity / distance * 100 : undefined, recent, changePercent: recent !== undefined && previous ? (recent - previous) / previous * 100 : undefined, distance, quantity, costCents, costPerKm: distance ? costCents / distance : undefined, averageUnitPriceCents: quantity ? costCents / quantity : undefined }
}

export function hybridEnergyCost(fuel: EnergyInterval[], charge: EnergyInterval[]) {
  const intervals = [...fuel, ...charge]
  if (!intervals.length) return undefined
  const distance = Math.max(...intervals.map(item => item.to.mileage!)) - Math.min(...intervals.map(item => item.from.mileage!))
  const records = new Map(intervals.flatMap(item => item.records).map(record => [record.id, record]))
  const costCents = [...records.values()].reduce((sum, record) => sum + record.amountCents, 0)
  return distance > 0 ? { distance, costCents, costPerKm: costCents / distance } : undefined
}

export function energyQuality(records: ExpenseRecord[], category: 'fuel' | 'charge') {
  const relevant = records.filter(record => record.category === category).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  let missingMileage = 0, missingQuantity = 0, unmarkedFull = 0, reversedMileage = 0, excluded = 0, previousMileage: number | undefined
  for (const record of relevant) {
    if (record.excludedFromEnergy) { excluded += 1; continue }
    const quantity = category === 'fuel' ? record.fuelLiters : record.chargeKwh, full = category === 'fuel' ? record.isFullFuel : record.isFullCharge
    if (record.mileage === undefined) missingMileage += 1
    if (!quantity || quantity <= 0) missingQuantity += 1
    if (quantity && quantity > 0 && !full) unmarkedFull += 1
    if (record.mileage !== undefined) {
      if (previousMileage !== undefined && record.mileage <= previousMileage) reversedMileage += 1
      else previousMileage = record.mileage
    }
  }
  return { total: relevant.length, completeIntervals: energyIntervals(relevant, category).length, missingMileage, missingQuantity, unmarkedFull, reversedMileage, excluded }
}
