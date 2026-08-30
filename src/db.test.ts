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
})
