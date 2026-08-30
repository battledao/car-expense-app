import { afterEach, describe, expect, it } from 'vitest'
import { createBackup, restoreBackup, validateBackup } from './backup'
import { CarDb } from './db'

const dbs: CarDb[] = []; const testDb = () => { const db = new CarDb(`backup-${crypto.randomUUID()}`); dbs.push(db); return db }
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.delete())) })
const vehicle = { id: 'v1', name: '车辆', energyType: 'fuel' as const, initialMileage: 0, isDefault: true, createdAt: 'x', updatedAt: 'x' }
const record = { id: 'r1', vehicleId: 'v1', category: 'parking' as const, amountCents: 100, occurredAt: '2026-01-01T10:00', excludedFromEnergy: false, createdAt: 'x', updatedAt: 'x' }

describe('backup', () => {
  it('exports and restores a complete backup', async () => { const source = testDb(); await source.vehicles.add(vehicle); await source.records.add(record); await source.settings.put({ id: 'app', defaultVehicleId: 'v1' }); const backup = await createBackup(source), target = testDb(); await restoreBackup(target, backup, 'replace'); expect(await target.vehicles.toArray()).toEqual([vehicle]); expect(await target.records.toArray()).toEqual([record]) })
  it('rejects a record whose vehicle is absent before importing', () => { expect(() => validateBackup({ schemaVersion: 1, exportedAt: 'x', vehicles: [], records: [record] })).toThrow('关联的车辆不存在') })
  it('merges same ids and preserves unrelated existing data', async () => { const target = testDb(); await target.vehicles.add({ ...vehicle, name: '旧名称' }); await target.vehicles.add({ ...vehicle, id: 'v2', name: '保留车辆' }); await restoreBackup(target, { schemaVersion: 1, exportedAt: 'x', vehicles: [vehicle], records: [record] }, 'merge'); expect((await target.vehicles.get('v1'))?.name).toBe('车辆'); expect(await target.vehicles.get('v2')).toBeDefined(); expect(await target.records.count()).toBe(1) })
})
