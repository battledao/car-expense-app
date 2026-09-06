import { afterEach, describe, expect, it } from 'vitest'
import { CarDb } from './db'

const databases: CarDb[] = []
const createDb = () => { const database = new CarDb(`test-${crypto.randomUUID()}`); databases.push(database); return database }
const vehicle = (id: string, name = '日常用车') => ({ id, name, energyType: 'fuel' as const, initialMileage: 1000 })

afterEach(async () => { await Promise.all(databases.splice(0).map(database => database.delete())) })

describe('CarDb', () => {
  it('makes the first vehicle the default and persists the selected vehicle', async () => {
    const database = createDb()
    await database.saveVehicle(vehicle('v1'))
    expect(await database.vehicles.get('v1')).toMatchObject({ isDefault: true })
    expect(await database.settings.get('app')).toMatchObject({ defaultVehicleId: 'v1', selectedVehicleId: 'v1' })
  })

  it('switches the default vehicle without leaving two defaults', async () => {
    const database = createDb()
    await database.saveVehicle(vehicle('v1'))
    await database.saveVehicle(vehicle('v2', '家庭用车'))
    await database.setDefaultVehicle('v2')
    expect((await database.vehicles.filter(item => item.isDefault).toArray()).map(item => item.id)).toEqual(['v2'])
    expect(await database.settings.get('app')).toMatchObject({ defaultVehicleId: 'v2', selectedVehicleId: undefined })
  })

  it('keeps legacy vehicle fields and creation time while editing', async () => {
    const database = createDb()
    await database.saveVehicle({ ...vehicle('v1'), brandModel: '旧型号', plateNumber: '京A1' })
    const before = await database.vehicles.get('v1')
    await database.saveVehicle({ ...vehicle('v1', '新名称'), plateNumber: '京A2' })
    expect(await database.vehicles.get('v1')).toMatchObject({ name: '新名称', plateNumber: '京A2', brandModel: '旧型号', createdAt: before?.createdAt })
  })

  it('deletes a vehicle and all of its records atomically', async () => {
    const database = createDb()
    await database.saveVehicle(vehicle('v1'))
    await database.saveRecord({ id: 'r1', vehicleId: 'v1', category: 'parking', amountCents: 2000, occurredAt: '2026-08-30T10:00:00.000Z', excludedFromEnergy: false, createdAt: '2026-08-30T10:00:00.000Z', updatedAt: '2026-08-30T10:00:00.000Z' })
    await database.removeVehicle('v1')
    expect(await database.vehicles.count()).toBe(0)
    expect(await database.records.count()).toBe(0)
    expect(await database.settings.get('app')).toBeUndefined()
  })

  it('promotes a stable replacement when deleting the default vehicle', async () => {
    const database = createDb()
    await database.saveVehicle(vehicle('v1'))
    await database.saveVehicle(vehicle('v2', '第二辆车'))
    await database.removeVehicle('v1')
    expect(await database.vehicles.get('v2')).toMatchObject({ isDefault: true })
    expect(await database.settings.get('app')).toMatchObject({ defaultVehicleId: 'v2', selectedVehicleId: 'v2' })
  })
})
