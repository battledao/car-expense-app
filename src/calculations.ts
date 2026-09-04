import type { ExpenseCategory, ExpenseRecord, Vehicle } from './models'

export interface RecordFilters { vehicleId?: string; category?: ExpenseCategory; start?: string; end?: string; minCents?: number; maxCents?: number; query?: string }

export type AnalysisRangePreset = 'month' | 'three' | 'year' | 'all' | 'custom'
export interface AnalysisDateRange { start?: string; end?: string; error?: string }
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function analysisDateRange(preset: AnalysisRangePreset, now = new Date(), records: ExpenseRecord[] = [], customStart = '', customEnd = ''): AnalysisDateRange {
  const end = dateKey(now)
  if (preset === 'custom') {
    if (!customStart || !customEnd) return { error: '请选择开始和结束日期。' }
    if (customStart > customEnd) return { error: '开始日期不能晚于结束日期。' }
    return { start: customStart, end: customEnd }
  }
  if (preset === 'all') {
    if (!records.length) return {}
    const dates = records.map(record => record.occurredAt.slice(0, 10)).sort()
    return { start: dates[0], end: dates.at(-1) }
  }
  if (preset === 'year') return { start: `${now.getFullYear()}-01-01`, end }
  const monthsBack = preset === 'three' ? 2 : 0
  return { start: dateKey(new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)), end }
}

const utcDay = (value: string) => { const [year, month, day] = value.split('-').map(Number); return Date.UTC(year, month - 1, day) }
const shiftDate = (value: string, days: number) => dateKey(new Date(utcDay(value) + days * 86400000))
const monthsCovered = (start?: string, end?: string) => start && end ? (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7)) + 1 : 0

export function analysisSummary(records: ExpenseRecord[], range: AnalysisDateRange) {
  const current = filterRecords(records, range), total = totalCents(current), monthCount = monthsCovered(range.start, range.end), categories = byCategory(current)
  let previousCents: number | undefined, changePercent: number | undefined
  if (range.start && range.end) {
    const days = Math.round((utcDay(range.end) - utcDay(range.start)) / 86400000) + 1, previousEnd = shiftDate(range.start, -1), previousStart = shiftDate(previousEnd, 1 - days)
    previousCents = totalCents(filterRecords(records, { start: previousStart, end: previousEnd }))
    if (previousCents) changePercent = Math.round((total - previousCents) / previousCents * 1000) / 10
  }
  return { totalCents: total, count: current.length, monthCount, averageMonthCents: monthCount ? total / monthCount : 0, previousCents, changePercent, topCategory: categories[0]?.[0] as ExpenseCategory | undefined, activeVehicleCount: new Set(current.map(record => record.vehicleId)).size }
}

export function analysisCostPerKm(records: ExpenseRecord[]) {
  const mileageRecords = records.filter(record => record.mileage !== undefined).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  if (mileageRecords.length < 2) return { reason: '至少需要两条含里程记录。' }
  if (mileageRecords.some((record, index) => index > 0 && record.mileage! <= mileageRecords[index - 1].mileage!)) return { reason: '里程需要严格递增。' }
  const distance = mileageRecords.at(-1)!.mileage! - mileageRecords[0].mileage!, costCents = totalCents(records)
  return { distance, costCents, costPerKm: costCents / distance }
}

export function analysisTrend(records: ExpenseRecord[], range: AnalysisDateRange) {
  if (!range.start || !range.end || range.error) return []
  const days = Math.round((utcDay(range.end) - utcDay(range.start)) / 86400000) + 1
  if (days <= 31) return Array.from({ length: days }, (_, index) => {
    const key = shiftDate(range.start!, index), values = filterRecords(records, { start: key, end: key })
    return { key, start: key, end: key, totalCents: totalCents(values), count: values.length }
  })
  const result: { key: string; start: string; end: string; totalCents: number; count: number }[] = []
  let [year, month] = range.start.slice(0, 7).split('-').map(Number)
  const last = range.end.slice(0, 7)
  while (`${year}-${String(month).padStart(2, '0')}` <= last) {
    const key = `${year}-${String(month).padStart(2, '0')}`, monthEnd = `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`, start = key === range.start.slice(0, 7) ? range.start : `${key}-01`, end = key === last ? range.end : monthEnd, values = filterRecords(records, { start, end })
    result.push({ key, start, end, totalCents: totalCents(values), count: values.length })
    month += 1
    if (month === 13) { year += 1; month = 1 }
  }
  return result
}

export function analysisMonths(records: ExpenseRecord[], range: AnalysisDateRange) {
  if (!range.start || !range.end || range.error) return []
  const result: { key: string; start: string; end: string; totalCents: number; count: number; changeCents?: number; changePercent?: number }[] = []
  let [year, month] = range.start.slice(0, 7).split('-').map(Number)
  const last = range.end.slice(0, 7)
  while (`${year}-${String(month).padStart(2, '0')}` <= last) {
    const key = `${year}-${String(month).padStart(2, '0')}`, monthEnd = `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`, start = key === range.start.slice(0, 7) ? range.start : `${key}-01`, end = key === last ? range.end : monthEnd, values = filterRecords(records, { start, end }), total = totalCents(values), previous = result.at(-1)
    result.push({ key, start, end, totalCents: total, count: values.length, changeCents: previous?.totalCents ? total - previous.totalCents : undefined, changePercent: previous?.totalCents ? Math.round((total - previous.totalCents) / previous.totalCents * 1000) / 10 : undefined })
    month += 1
    if (month === 13) { year += 1; month = 1 }
  }
  return result
}

export function analysisCategories(records: ExpenseRecord[]) {
  const total = totalCents(records)
  return categoriesIn(records).map(([category, values]) => ({ category, totalCents: totalCents(values), count: values.length, percent: total ? Math.round(totalCents(values) / total * 1000) / 10 : 0 })).sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category))
}

function categoriesIn(records: ExpenseRecord[]) {
  const groups: Partial<Record<ExpenseCategory, ExpenseRecord[]>> = {}
  for (const record of records) (groups[record.category] ??= []).push(record)
  return Object.entries(groups).map(([category, values]) => [category as ExpenseCategory, values ?? []] as const)
}

export function analysisVehicles(records: ExpenseRecord[], vehicles: Vehicle[]) {
  const total = totalCents(records)
  return vehicles.map(vehicle => { const values = records.filter(record => record.vehicleId === vehicle.id), amount = totalCents(values); return { vehicleId: vehicle.id, name: vehicle.name, totalCents: amount, count: values.length, percent: total ? Math.round(amount / total * 1000) / 10 : 0 } }).sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, 'zh-CN'))
}

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

const shiftMonth = (value: string, offset: number) => {
  const date = new Date(`${value}-01T00:00`)
  date.setMonth(date.getMonth() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
export function monthSummary(records: ExpenseRecord[], selectedMonth: string) {
  const current = records.filter(record => monthKey(record.occurredAt) === selectedMonth)
  const currentCents = totalCents(current), previousCents = totalCents(records.filter(record => monthKey(record.occurredAt) === shiftMonth(selectedMonth, -1)))
  return { totalCents: currentCents, count: current.length, averageCents: current.length ? currentCents / current.length : undefined, changePercent: previousCents ? Math.round((currentCents - previousCents) / previousCents * 100000) / 1000 : undefined }
}
export function monthlyTrend(records: ExpenseRecord[], selectedMonth: string, months = 6) {
  return Array.from({ length: months }, (_, index) => {
    const month = shiftMonth(selectedMonth, index - months + 1)
    return { month, totalCents: totalCents(records.filter(record => monthKey(record.occurredAt) === month)) }
  })
}
export function monthlyCostPerKm(records: ExpenseRecord[], selectedMonth: string) {
  const inMonth = records.filter(record => monthKey(record.occurredAt) === selectedMonth)
  const mileageRecords = inMonth.filter(record => record.mileage !== undefined).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  if (mileageRecords.length < 2) return { reason: '至少需要两条含里程记录。' }
  if (mileageRecords.some((record, index) => index && record.mileage! <= mileageRecords[index - 1].mileage!)) return { reason: '里程需要严格递增。' }
  const distance = mileageRecords.at(-1)!.mileage! - mileageRecords[0].mileage!
  const costCents = totalCents(inMonth)
  return { costCents, distance, costPerKm: costCents / distance }
}
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
