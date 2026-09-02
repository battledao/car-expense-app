import type { EnergyType, ExpenseCategory } from './models'

export type CategoryGroup = { name: string; categories: ExpenseCategory[] }
export type EnergyField = 'amount' | 'quantity' | 'unitPrice'
export type EnergyValues = { amount: string; quantity: string; unitPrice: string }

export const categoryGroups: CategoryGroup[] = [
  { name: '补能费用', categories: ['fuel', 'charge'] },
  { name: '日常用车', categories: ['parking', 'wash', 'toll', 'fine'] },
  { name: '车辆养护', categories: ['maintenance', 'repair', 'insurance', 'inspection', 'supplies'] },
  { name: '其他', categories: ['other'] },
]

export const categoryIcons: Record<ExpenseCategory, string> = { fuel: '⛽', charge: '⚡', parking: '🅿', wash: '✦', maintenance: '🔧', repair: '🛠', insurance: '🛡', inspection: '✓', toll: '🛣', fine: '!', supplies: '▣', other: '…' }

export const isEnergyCategory = (category: ExpenseCategory) => category === 'fuel' || category === 'charge'

export const isCategoryAvailable = (energyType: EnergyType, category: ExpenseCategory) =>
  !isEnergyCategory(category) || energyType === 'hybrid' || (energyType === 'fuel' && category === 'fuel') || (energyType === 'electric' && category === 'charge')

export const availableCategories = (energyType?: EnergyType) =>
  categoryGroups.map(group => ({ ...group, categories: group.categories.filter(category => !energyType || isCategoryAvailable(energyType, category)) })).filter(group => group.categories.length)

const validNumber = (value: string) => value.trim() !== '' && Number.isFinite(Number(value))
const decimal = (value: number) => Number.isFinite(value) && value >= 0 ? value.toFixed(2) : ''

export function reconcileEnergyValues(values: EnergyValues, changed: EnergyField): EnergyValues {
  const amount = Number(values.amount), quantity = Number(values.quantity), unitPrice = Number(values.unitPrice)
  if (!validNumber(values.quantity) || quantity <= 0) return values
  if (changed === 'amount' && validNumber(values.amount)) return { ...values, unitPrice: decimal(amount / quantity) }
  if ((changed === 'quantity' || changed === 'unitPrice') && validNumber(values.unitPrice)) return { ...values, amount: decimal(quantity * unitPrice) }
  return values
}

export type EnergyRecordFields = { fuelLiters?: number; fuelGrade?: string; chargeKwh?: number; chargeMethod?: string; unitPriceCents?: number; isFullFuel?: boolean; isFullCharge?: boolean }

export function fieldsForCategory(category: ExpenseCategory, fields: EnergyRecordFields): EnergyRecordFields {
  if (category === 'fuel') return { fuelLiters: fields.fuelLiters, fuelGrade: fields.fuelGrade, unitPriceCents: fields.unitPriceCents, isFullFuel: fields.isFullFuel }
  if (category === 'charge') return { chargeKwh: fields.chargeKwh, chargeMethod: fields.chargeMethod, unitPriceCents: fields.unitPriceCents, isFullCharge: fields.isFullCharge }
  return {}
}
