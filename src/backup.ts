import { z } from 'zod'
import type { CarDb } from './db'
import type { AppSettings, ExpenseRecord, Vehicle } from './models'

const energy = z.enum(['fuel', 'electric', 'hybrid'])
const category = z.enum(['fuel', 'charge', 'parking', 'wash', 'maintenance', 'repair', 'insurance', 'inspection', 'toll', 'fine', 'supplies', 'other'])
const vehicleSchema = z.object({ id: z.string().min(1), name: z.string().min(1), energyType: energy, initialMileage: z.number().nonnegative(), brandModel: z.string().optional(), plateNumber: z.string().optional(), purchaseDate: z.string().optional(), purchasePriceCents: z.number().int().nonnegative().optional(), fuelTankCapacity: z.number().nonnegative().optional(), batteryCapacity: z.number().nonnegative().optional(), isDefault: z.boolean(), createdAt: z.string(), updatedAt: z.string() })
const recordSchema = z.object({ id: z.string().min(1), vehicleId: z.string().min(1), category, amountCents: z.number().int().nonnegative(), occurredAt: z.string().min(1), mileage: z.number().nonnegative().optional(), merchantOrLocation: z.string().optional(), notes: z.string().optional(), fuelLiters: z.number().positive().optional(), fuelGrade: z.string().optional(), unitPriceCents: z.number().int().nonnegative().optional(), isFullFuel: z.boolean().optional(), chargeKwh: z.number().positive().optional(), chargeMethod: z.string().optional(), isFullCharge: z.boolean().optional(), excludedFromEnergy: z.boolean(), createdAt: z.string(), updatedAt: z.string() })
const settingsSchema = z.object({ id: z.literal('app'), selectedVehicleId: z.string().optional(), defaultVehicleId: z.string().optional() })
const backupSchema = z.object({ schemaVersion: z.literal(1), exportedAt: z.string(), vehicles: z.array(vehicleSchema), records: z.array(recordSchema), settings: settingsSchema.optional() }).superRefine((data, ctx) => { const ids = new Set(data.vehicles.map(item => item.id)); for (const record of data.records) if (!ids.has(record.vehicleId)) ctx.addIssue({ code: 'custom', message: `记录 ${record.id} 关联的车辆不存在` }); for (const id of [data.settings?.selectedVehicleId, data.settings?.defaultVehicleId]) if (id && !ids.has(id)) ctx.addIssue({ code: 'custom', message: '设置关联的车辆不存在' }) })
export type BackupData = { schemaVersion: 1; exportedAt: string; vehicles: Vehicle[]; records: ExpenseRecord[]; settings?: AppSettings }

export function validateBackup(input: unknown): BackupData { return backupSchema.parse(input) as BackupData }
export async function createBackup(database: CarDb): Promise<BackupData> { return { schemaVersion: 1, exportedAt: new Date().toISOString(), vehicles: await database.vehicles.toArray(), records: await database.records.toArray(), settings: await database.settings.get('app') } }
export async function restoreBackup(database: CarDb, input: unknown, mode: 'merge' | 'replace') {
  const backup = validateBackup(input)
  await database.transaction('rw', database.vehicles, database.records, database.settings, async () => {
    if (mode === 'replace') { await database.vehicles.clear(); await database.records.clear(); await database.settings.clear() }
    await database.vehicles.bulkPut(backup.vehicles)
    await database.records.bulkPut(backup.records)
    if (backup.settings) await database.settings.put(backup.settings)
  })
  return backup
}
export function downloadBackup(backup: BackupData) { const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `car-expense-backup-${backup.exportedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`; anchor.click(); URL.revokeObjectURL(url) }
