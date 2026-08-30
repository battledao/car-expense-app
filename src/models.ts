export type EnergyType = 'fuel' | 'electric' | 'hybrid'
export type ExpenseCategory = 'fuel' | 'charge' | 'parking' | 'wash' | 'maintenance' | 'repair' | 'insurance' | 'inspection' | 'toll' | 'fine' | 'supplies' | 'other'

export interface Vehicle {
  id: string
  name: string
  energyType: EnergyType
  initialMileage: number
  brandModel?: string
  plateNumber?: string
  purchaseDate?: string
  purchasePriceCents?: number
  fuelTankCapacity?: number
  batteryCapacity?: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface ExpenseRecord {
  id: string
  vehicleId: string
  category: ExpenseCategory
  amountCents: number
  occurredAt: string
  mileage?: number
  merchantOrLocation?: string
  notes?: string
  fuelLiters?: number
  fuelGrade?: string
  unitPriceCents?: number
  isFullFuel?: boolean
  chargeKwh?: number
  chargeMethod?: string
  isFullCharge?: boolean
  excludedFromEnergy: boolean
  createdAt: string
  updatedAt: string
}

export interface AppSettings { id: 'app'; selectedVehicleId?: string; defaultVehicleId?: string }
