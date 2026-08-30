import type { EnergyType, ExpenseCategory } from './models'

export const categoryLabels: Record<ExpenseCategory, string> = { fuel: '加油', charge: '充电', parking: '停车', wash: '洗车', maintenance: '保养', repair: '维修', insurance: '保险', inspection: '年检', toll: '高速及路桥费', fine: '违章罚款', supplies: '汽车用品', other: '其他费用' }
export const categories = Object.keys(categoryLabels) as ExpenseCategory[]
export const energyLabels: Record<EnergyType, string> = { fuel: '燃油车', electric: '纯电动车', hybrid: '插电式混动' }
export const isEnergyCategory = (category: ExpenseCategory) => category === 'fuel' || category === 'charge'
export const formatMoney = (cents: number) => `¥${(cents / 100).toFixed(2)}`
export const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value))
export const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
