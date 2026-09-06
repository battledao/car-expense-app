import { describe, expect, it } from 'vitest'
import { duplicateVehicleWarnings, hasEnergyRecords, minimumValidMileage, sortVehicles, vehicleFormErrors } from './vehicleForm'
import type { ExpenseRecord, Vehicle } from './models'

const vehicle = (id: string, overrides: Partial<Vehicle> = {}): Vehicle => ({ id, name: id, energyType: 'fuel', initialMileage: 0, isDefault: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides })
const record = (mileage?: number, category: ExpenseRecord['category'] = 'parking'): ExpenseRecord => ({ id: crypto.randomUUID(), vehicleId: 'v1', category, amountCents: 100, occurredAt: '2026-01-01T00:00', mileage, excludedFromEnergy: false, createdAt: '', updatedAt: '' })

describe('vehicle form rules', () => {
  it('validates required text, mileage precision and plate length', () => {
    expect(vehicleFormErrors({ name: '  ', energyType: 'fuel', initialMileage: '1.25', plateNumber: 'x'.repeat(21) }, [])).toEqual({ name: '车辆名称需为 1～30 个字符。', initialMileage: '初始里程必须为最多 1 位小数的非负数。', plateNumber: '车牌号不能超过 20 个字符。' })
    expect(vehicleFormErrors({ name: '测试车', energyType: 'fuel', initialMileage: '1.2', plateNumber: ' A 1 ' }, [])).toEqual({})
  })

  it('protects the historical minimum valid mileage', () => {
    expect(minimumValidMileage([record(undefined), record(-1), record(Number.NaN), record(120), record(80)])).toBe(80)
    expect(vehicleFormErrors({ name: '测试车', energyType: 'fuel', initialMileage: '80.1', plateNumber: '' }, [record(80)])).toMatchObject({ initialMileage: expect.stringContaining('80') })
  })

  it('warns about duplicates without treating them as invalid input', () => {
    const values = { name: ' 家庭用车 ', energyType: 'fuel' as const, initialMileage: '0', plateNumber: ' 京A12345 ' }
    expect(vehicleFormErrors(values, [])).toEqual({})
    expect(duplicateVehicleWarnings(values, [vehicle('v1', { name: '家庭用车', plateNumber: '京A12345' })])).toEqual(['已有同名车辆。', '已有相同车牌号。'])
    expect(duplicateVehicleWarnings(values, [vehicle('v1', { name: '家庭用车', plateNumber: '京A12345' })], 'v1')).toEqual([])
  })

  it('recognizes energy records and sorts default vehicles stably', () => {
    expect(hasEnergyRecords([record(1), record(2, 'charge')])).toBe(true)
    expect(sortVehicles([vehicle('b', { createdAt: '2026-01-02T00:00:00.000Z' }), vehicle('a', { isDefault: true, createdAt: '2026-01-03T00:00:00.000Z' }), vehicle('c', { createdAt: '2026-01-01T00:00:00.000Z' })]).map(item => item.id)).toEqual(['a', 'c', 'b'])
  })
})
