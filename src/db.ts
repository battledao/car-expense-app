import Dexie, { type Table } from 'dexie'
import type { AppSettings, ExpenseRecord, Vehicle } from './models'

const now = () => new Date().toISOString()

export class CarDb extends Dexie {
  vehicles!: Table<Vehicle, string>
  records!: Table<ExpenseRecord, string>
  settings!: Table<AppSettings, string>

  constructor(name = 'car-expense-app') {
    super(name)
    this.version(1).stores({
      vehicles: 'id,isDefault',
      records: 'id,vehicleId,occurredAt,category,[vehicleId+occurredAt]',
      settings: 'id',
    })
  }

  async saveVehicle(input: Omit<Vehicle, 'createdAt' | 'updatedAt' | 'isDefault'> & { isDefault?: boolean }) {
    const existing = await this.vehicles.get(input.id)
    const count = await this.vehicles.count()
    const vehicle: Vehicle = { ...input, isDefault: input.isDefault ?? existing?.isDefault ?? count === 0, createdAt: existing?.createdAt ?? now(), updatedAt: now() }
    await this.transaction('rw', this.vehicles, this.settings, async () => {
      if (vehicle.isDefault) await this.vehicles.toCollection().modify({ isDefault: false })
      await this.vehicles.put(vehicle)
      if (vehicle.isDefault) await this.settings.put({ id: 'app', defaultVehicleId: vehicle.id, selectedVehicleId: vehicle.id })
    })
    return vehicle
  }

  async setDefaultVehicle(id: string) {
    await this.transaction('rw', this.vehicles, this.settings, async () => {
      if (!await this.vehicles.get(id)) throw new Error('车辆不存在')
      await this.vehicles.toCollection().modify({ isDefault: false })
      await this.vehicles.update(id, { isDefault: true, updatedAt: now() })
      await this.settings.put({ id: 'app', defaultVehicleId: id, selectedVehicleId: id })
    })
  }

  async removeVehicle(id: string) {
    await this.transaction('rw', this.vehicles, this.records, this.settings, async () => {
      await this.records.where('vehicleId').equals(id).delete()
      await this.vehicles.delete(id)
      const settings = await this.settings.get('app')
      if (settings?.selectedVehicleId === id || settings?.defaultVehicleId === id) {
        const next = await this.vehicles.filter(vehicle => vehicle.isDefault).first() ?? (await this.vehicles.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
        if (next) { await this.vehicles.update(next.id, { isDefault: true }); await this.settings.put({ id: 'app', defaultVehicleId: next.id, selectedVehicleId: next.id }) }
        else await this.settings.delete('app')
      }
    })
  }

  async saveRecord(record: ExpenseRecord) { await this.records.put(record); return record }
  async removeRecord(id: string) { await this.records.delete(id) }
}

export const db = new CarDb()
