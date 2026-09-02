import { describe, expect, it } from 'vitest'
import { availableCategories, fieldsForCategory, isCategoryAvailable, reconcileEnergyValues } from './recordForm'

describe('用车记账规则', () => {
  it('按车型仅提供适用的补能类别，同时保留普通费用', () => {
    expect(isCategoryAvailable('fuel', 'charge')).toBe(false)
    expect(isCategoryAvailable('electric', 'fuel')).toBe(false)
    expect(isCategoryAvailable('hybrid', 'fuel')).toBe(true)
    expect(isCategoryAvailable('hybrid', 'charge')).toBe(true)
    expect(availableCategories('fuel').flatMap(group => group.categories)).toContain('parking')
  })

  it('按最后修改字段双向计算补能金额和单价', () => {
    expect(reconcileEnergyValues({ amount: '', quantity: '10', unitPrice: '7.23' }, 'unitPrice')).toEqual({ amount: '72.30', quantity: '10', unitPrice: '7.23' })
    expect(reconcileEnergyValues({ amount: '80', quantity: '10', unitPrice: '7.23' }, 'amount')).toEqual({ amount: '80', quantity: '10', unitPrice: '8.00' })
    expect(reconcileEnergyValues({ amount: '80', quantity: '', unitPrice: '7.23' }, 'amount')).toEqual({ amount: '80', quantity: '', unitPrice: '7.23' })
  })

  it('保存时只保留当前场景适用的补能字段', () => {
    const fields = { fuelLiters: 10, fuelGrade: '95号', chargeKwh: 20, chargeMethod: '公共直流快充', unitPriceCents: 800, isFullFuel: true, isFullCharge: true }
    expect(fieldsForCategory('fuel', fields)).toEqual({ fuelLiters: 10, fuelGrade: '95号', unitPriceCents: 800, isFullFuel: true })
    expect(fieldsForCategory('charge', fields)).toEqual({ chargeKwh: 20, chargeMethod: '公共直流快充', unitPriceCents: 800, isFullCharge: true })
    expect(fieldsForCategory('parking', fields)).toEqual({})
  })
})
