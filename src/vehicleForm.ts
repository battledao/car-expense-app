import type { EnergyType, ExpenseRecord, Vehicle } from './models'

export type VehicleFormValues = { name: string; energyType: EnergyType; initialMileage: string; plateNumber: string }

export const normalizeVehicleText = (value: string) => value.trim()

export function vehicleFormErrors(values: VehicleFormValues, records: ExpenseRecord[], vehicleId?: string) {
  const name = normalizeVehicleText(values.name), plateNumber = normalizeVehicleText(values.plateNumber), mileage = Number(values.initialMileage), errors: Record<string, string> = {}
  if (!name || name.length > 30) errors.name = '车辆名称需为 1～30 个字符。'
  if (!Number.isFinite(mileage) || mileage < 0 || !/^\d+(\.\d)?$/.test(values.initialMileage)) errors.initialMileage = '初始里程必须为最多 1 位小数的非负数。'
  if (plateNumber.length > 20) errors.plateNumber = '车牌号不能超过 20 个字符。'
  const minimum = minimumValidMileage(records)
  if (!errors.initialMileage && minimum !== undefined && mileage > minimum) errors.initialMileage = `初始里程不能高于历史最低有效里程 ${minimum} km。`
  return errors
}

export function duplicateVehicleWarnings(values: VehicleFormValues, vehicles: Vehicle[], vehicleId?: string) {
  const name = normalizeVehicleText(values.name), plateNumber = normalizeVehicleText(values.plateNumber), others = vehicles.filter(vehicle => vehicle.id !== vehicleId)
  return [others.some(vehicle => normalizeVehicleText(vehicle.name) === name) && name ? '已有同名车辆。' : undefined, others.some(vehicle => normalizeVehicleText(vehicle.plateNumber ?? '') === plateNumber) && plateNumber ? '已有相同车牌号。' : undefined].filter(Boolean) as string[]
}

export function minimumValidMileage(records: ExpenseRecord[]) {
  const values = records.map(record => record.mileage).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
  return values.length ? Math.min(...values) : undefined
}

export const hasEnergyRecords = (records: ExpenseRecord[]) => records.some(record => record.category === 'fuel' || record.category === 'charge')

export function sortVehicles(vehicles: Vehicle[]) {
  return [...vehicles].sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
}
