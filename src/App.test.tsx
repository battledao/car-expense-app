import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it } from 'vitest'
import App from './App'
import { db } from './db'

beforeEach(async () => {
  await db.transaction('rw', db.vehicles, db.records, db.settings, async () => {
    await db.records.clear()
    await db.vehicles.clear()
    await db.settings.clear()
  })
})
afterEach(cleanup)

it('shows all seven primary navigation items', () => {
  render(<MemoryRouter><App /></MemoryRouter>)
  for (const label of ['首页总览', '用车记账', '费用日历', '数据分析', '详细记录', '能耗统计', '车辆管理']) expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '＋记一笔' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '数据管理' })).toBeInTheDocument()
  expect(screen.getAllByText(/⌂|✎|□|◔|☷|ϟ|▣/)).toHaveLength(7)
})

it('provides vehicle-aware energy controls and a twelve-month default range', async () => {
  await db.saveVehicle({ id: 'fuel', name: '燃油测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveVehicle({ id: 'electric', name: '纯电测试车', energyType: 'electric', initialMileage: 0 })
  render(<MemoryRouter initialEntries={['/energy']}><App /></MemoryRouter>)

  expect(await screen.findByRole('heading', { name: '能耗统计' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText('能耗车辆')).toHaveValue('fuel'))
  expect(screen.getByLabelText('能耗时间范围')).toHaveValue('twelve')
  expect(screen.getByRole('link', { name: '记录加油' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '记录充电' })).not.toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('能耗车辆'), { target: { value: 'electric' } })
  await waitFor(() => expect(screen.getByRole('link', { name: '记录充电' })).toBeInTheDocument())
  expect(screen.queryByRole('link', { name: '记录加油' })).not.toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('能耗时间范围'), { target: { value: 'custom' } })
  expect(screen.getByLabelText('能耗开始日期')).toBeInTheDocument()
  expect(screen.getByLabelText('能耗结束日期')).toBeInTheDocument()
})

it('asks for a concrete vehicle when the global selection is all vehicles', async () => {
  await db.saveVehicle({ id: 'fuel', name: '燃油测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  render(<MemoryRouter initialEntries={['/energy']}><App /></MemoryRouter>)
  await waitFor(() => expect(screen.getByLabelText('能耗车辆')).toHaveValue('fuel'))
  fireEvent.change(screen.getByLabelText('当前车辆'), { target: { value: 'all' } })
  expect(await screen.findByText('请选择一辆具体车辆查看能耗统计。')).toBeInTheDocument()
  expect(screen.getByLabelText('选择能耗车辆')).toBeInTheDocument()
})
it('shows weighted fuel metrics and data quality for a complete interval', async () => {
  await db.saveVehicle({ id: 'fuel', name: '燃油测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  const base = { vehicleId: 'fuel', category: 'fuel' as const, excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'start', occurredAt: '2026-08-01T10:00', mileage: 1000, fuelLiters: 50, amountCents: 25000, isFullFuel: true })
  await db.saveRecord({ ...base, id: 'partial', occurredAt: '2026-08-10T10:00', mileage: 1200, fuelLiters: 20, amountCents: 10000, isFullFuel: false })
  await db.saveRecord({ ...base, id: 'end', occurredAt: '2026-08-20T10:00', mileage: 1500, fuelLiters: 25, amountCents: 12500, isFullFuel: true })
  render(<MemoryRouter initialEntries={['/energy']}><App /></MemoryRouter>)

  expect(await screen.findByText('平均油耗')).toBeInTheDocument()
  expect(screen.getByText('平均油耗').closest('.metric')).toHaveTextContent('9.00 L/100km')
  expect(screen.getByText('最近油耗').closest('.metric')).toHaveTextContent('9.00 L/100km')
  expect(screen.getByText('每公里燃油成本').closest('.metric')).toHaveTextContent('¥0.45/km')
  expect(screen.getByText('平均油价').closest('.metric')).toHaveTextContent('¥5.00/L')
  expect(screen.getByText('有效完整区间：1')).toBeInTheDocument()
  expect(screen.getByText('未标记加满：1')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '油耗趋势图' })).toBeInTheDocument()
  expect(screen.getByText('加权平均：9.00 L/100km')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '油价趋势图' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /查看区间.*2026年8月20日/ }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已选择区间：2026年8月20日'))
})

it('shows newest energy intervals first and traces every included record', async () => {
  await db.saveVehicle({ id: 'fuel', name: '区间测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  const base = { vehicleId: 'fuel', category: 'fuel' as const, excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'boundary-1', occurredAt: '2026-08-01T10:00', mileage: 1000, fuelLiters: 50, amountCents: 25000, isFullFuel: true })
  await db.saveRecord({ ...base, id: 'boundary-2', occurredAt: '2026-08-10T10:00', mileage: 1500, fuelLiters: 40, amountCents: 20000, isFullFuel: true })
  await db.saveRecord({ ...base, id: 'partial-2', occurredAt: '2026-08-15T10:00', mileage: 1650, fuelLiters: 10, amountCents: 5000, isFullFuel: false })
  await db.saveRecord({ ...base, id: 'boundary-3', occurredAt: '2026-08-20T10:00', mileage: 1800, fuelLiters: 20, amountCents: 10000, isFullFuel: true })
  render(<MemoryRouter initialEntries={['/energy']}><App /></MemoryRouter>)

  const table = await screen.findByRole('table', { name: '油耗区间明细' })
  const rows = within(table).getAllByRole('row')
  expect(rows[1]).toHaveTextContent('2026年8月10日 → 2026年8月20日')
  expect(rows[1]).toHaveTextContent('300.0 km')
  expect(rows[1]).toHaveTextContent('30.00 L')
  expect(rows[1]).toHaveTextContent('10.00 L/100km')
  expect(rows[2]).toHaveTextContent('2026年8月1日 → 2026年8月10日')

  fireEvent.click(within(rows[1]).getByRole('button', { name: '查看2026年8月20日区间计算依据' }))
  const basis = screen.getByRole('region', { name: '区间计算依据' })
  expect(basis).toHaveTextContent('计算基准（起始边界）：2026年8月10日 · 1500 km')
  expect(basis).toHaveTextContent('区间内补能：2026年8月15日 · 10.00 L')
  expect(basis).toHaveTextContent('结束边界：2026年8月20日 · 20.00 L')
})
it('filters, edits, excludes and restores replenishment records', async () => {
  await db.saveVehicle({ id: 'fuel', name: '记录管理车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  const base = { vehicleId: 'fuel', category: 'fuel' as const, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'valid', occurredAt: '2026-08-20T10:00', mileage: 1500, fuelLiters: 25, amountCents: 12500, isFullFuel: true, excludedFromEnergy: false })
  await db.saveRecord({ ...base, id: 'incomplete', occurredAt: '2026-08-15T10:00', fuelLiters: 10, amountCents: 5000, isFullFuel: false, excludedFromEnergy: false })
  await db.saveRecord({ ...base, id: 'excluded', occurredAt: '2026-08-10T10:00', mileage: 1200, fuelLiters: 20, amountCents: 10000, isFullFuel: false, excludedFromEnergy: true })
  render(<MemoryRouter initialEntries={['/energy']}><App /></MemoryRouter>)

  const filter = await screen.findByLabelText('补能记录筛选')
  expect(within(screen.getByRole('table', { name: '补能记录' })).getAllByRole('row')).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: '查看2026年8月20日加油记录' }))
  const viewDialog = screen.getByRole('dialog', { name: '查看补能记录' })
  expect(viewDialog).toHaveTextContent('1500 km')
  expect(viewDialog).toHaveTextContent('25.00 L')
  expect(viewDialog).toHaveTextContent('¥125.00')
  fireEvent.click(within(viewDialog).getByRole('button', { name: '关闭' }))
  fireEvent.click(screen.getByRole('button', { name: '未标记加满：1' }))
  expect(filter).toHaveValue('unmarked')
  expect(within(screen.getByRole('table', { name: '补能记录' })).getByText('2026年8月15日')).toBeInTheDocument()

  fireEvent.change(filter, { target: { value: 'incomplete' } })
  const incompleteTable = screen.getByRole('table', { name: '补能记录' })
  expect(within(incompleteTable).getByText('2026年8月15日')).toBeInTheDocument()
  expect(within(incompleteTable).queryByText('2026年8月20日')).not.toBeInTheDocument()

  fireEvent.change(filter, { target: { value: 'excluded' } })
  const excludedTable = screen.getByRole('table', { name: '补能记录' })
  fireEvent.click(within(excludedTable).getByRole('button', { name: '恢复2026年8月10日加油记录' }))
  await waitFor(() => expect(screen.queryByRole('table', { name: '补能记录' })).not.toBeInTheDocument())

  fireEvent.change(filter, { target: { value: 'valid' } })
  const validTable = screen.getByRole('table', { name: '补能记录' })
  fireEvent.click(within(validTable).getByRole('button', { name: '编辑2026年8月20日加油记录' }))
  const amount = screen.getByLabelText('金额（元）')
  expect(amount).toHaveValue(125)
  fireEvent.change(amount, { target: { value: '130' } })
  fireEvent.click(screen.getByRole('button', { name: '保存记录' }))
  await waitFor(() => expect(within(screen.getByRole('table', { name: '补能记录' })).getByText('¥130.00')).toBeInTheDocument())

  fireEvent.click(within(screen.getByRole('table', { name: '补能记录' })).getByRole('button', { name: '排除2026年8月20日加油记录' }))
  await waitFor(() => expect(within(screen.getByRole('table', { name: '补能记录' })).queryByText('2026年8月20日')).not.toBeInTheDocument())
  fireEvent.change(filter, { target: { value: 'excluded' } })
  expect(within(screen.getByRole('table', { name: '补能记录' })).getByText('2026年8月20日')).toBeInTheDocument()
})
it('keeps hybrid fuel and charge separate while showing combined energy cost', async () => {
  await db.saveVehicle({ id: 'hybrid', name: '插混测试车', energyType: 'hybrid', initialMileage: 0, isDefault: true })
  const base = { vehicleId: 'hybrid', excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'fuel-start', category: 'fuel', occurredAt: '2026-08-01T10:00', mileage: 1000, fuelLiters: 50, amountCents: 25000, isFullFuel: true })
  await db.saveRecord({ ...base, id: 'charge-start', category: 'charge', occurredAt: '2026-08-02T10:00', mileage: 1100, chargeKwh: 30, amountCents: 3000, isFullCharge: true })
  await db.saveRecord({ ...base, id: 'fuel-end', category: 'fuel', occurredAt: '2026-08-20T10:00', mileage: 1500, fuelLiters: 40, amountCents: 20000, isFullFuel: true })
  await db.saveRecord({ ...base, id: 'charge-end', category: 'charge', occurredAt: '2026-08-21T10:00', mileage: 1600, chargeKwh: 60, amountCents: 6000, isFullCharge: true })
  render(<MemoryRouter initialEntries={['/energy']}><App /></MemoryRouter>)

  expect(await screen.findByText('燃油能耗')).toBeInTheDocument()
  expect(screen.getByText('充电能耗')).toBeInTheDocument()
  expect(screen.getByText('平均油耗').closest('.metric')).toHaveTextContent('8.00 L/100km')
  expect(screen.getByText('平均电耗').closest('.metric')).toHaveTextContent('12.00 kWh/100km')
  expect(screen.getByText('综合能源成本').closest('.metric')).toHaveTextContent('¥0.43/km')
  expect(screen.getByText('燃油费用占比').closest('.metric')).toHaveTextContent('¥200.00 · 76.9%')
  expect(screen.getByText('充电费用占比').closest('.metric')).toHaveTextContent('¥60.00 · 23.1%')
  expect(screen.queryByText('综合能耗')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: '油耗趋势图' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '电耗趋势图' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '油耗成本趋势图' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '电耗成本趋势图' })).toBeInTheDocument()
})
it('explains when a selected vehicle has no energy records', async () => {
  await db.saveVehicle({ id: 'electric', name: '纯电测试车', energyType: 'electric', initialMileage: 0, isDefault: true })
  render(<MemoryRouter initialEntries={['/energy']}><App /></MemoryRouter>)
  expect(await screen.findByText('尚无充电记录，请先记录一次充电。')).toBeInTheDocument()
  expect(screen.queryByText('0.00 kWh/100km')).not.toBeInTheDocument()
})
