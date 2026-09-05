import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { db } from './db'
import type { ExpenseCategory } from './models'

beforeEach(async () => {
  await db.transaction('rw', db.vehicles, db.records, db.settings, async () => {
    await db.records.clear()
    await db.vehicles.clear()
    await db.settings.clear()
  })
})
afterEach(async () => {
  vi.restoreAllMocks()
  cleanup()
  await db.transaction('rw', db.vehicles, db.records, db.settings, async () => {
    await db.records.clear()
    await db.vehicles.clear()
    await db.settings.clear()
  })
})

it('shows all seven primary navigation items', () => {
  render(<MemoryRouter><App /></MemoryRouter>)
  for (const label of ['首页总览', '用车记账', '费用日历', '数据分析', '详细记录', '能耗统计', '车辆管理']) expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '＋记一笔' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '数据管理' })).toBeInTheDocument()
  expect(screen.getAllByText(/⌂|✎|□|◔|☷|ϟ|▣/)).toHaveLength(7)
})

it('reads analysis filters from the URL, validates custom dates and clears filters', async () => {
  await db.saveVehicle({ id: 'analysis-filters', name: '分析筛选车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  render(<MemoryRouter initialEntries={['/analysis?range=custom&start=2026-01-11&end=2026-01-10&category=parking']}><App /></MemoryRouter>)

  expect(await screen.findByLabelText('时间范围')).toHaveValue('custom')
  expect(screen.getByLabelText('分析类别')).toHaveValue('parking')
  expect(screen.getByLabelText('分析开始日期')).toHaveValue('2026-01-11')
  expect(screen.getByLabelText('分析结束日期')).toHaveValue('2026-01-10')
  expect(screen.getByRole('alert')).toHaveTextContent('开始日期不能晚于结束日期。')
  expect(screen.queryByText('总费用')).not.toBeInTheDocument()
  expect(screen.getByRole('option', { name: '全部时间' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '清除筛选' }))
  expect(screen.getByLabelText('时间范围')).toHaveValue('year')
  expect(screen.getByLabelText('分析类别')).toHaveValue('')
  expect(screen.queryByLabelText('分析开始日期')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('shows analysis summary, previous-period change and single-vehicle cost per kilometre', async () => {
  await db.saveVehicle({ id: 'analysis-summary', name: '分析指标车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.settings.put({ id: 'app', selectedVehicleId: 'analysis-summary', defaultVehicleId: 'analysis-summary' })
  const base = { vehicleId: 'analysis-summary', excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'previous', category: 'parking', amountCents: 1000, occurredAt: '2026-04-15T10:00' })
  await db.saveRecord({ ...base, id: 'may', category: 'parking', amountCents: 2000, occurredAt: '2026-05-01T10:00', mileage: 100 })
  await db.saveRecord({ ...base, id: 'july', category: 'wash', amountCents: 4000, occurredAt: '2026-07-31T10:00', mileage: 300 })

  render(<MemoryRouter initialEntries={['/analysis?range=custom&start=2026-05-01&end=2026-07-31']}><App /></MemoryRouter>)

  await waitFor(() => expect(screen.getByText('总费用').closest('.metric')).toHaveTextContent('¥60.00'))
  expect(screen.getByText('记录数量').closest('.metric')).toHaveTextContent('2 笔')
  expect(screen.getByText('平均每月费用').closest('.metric')).toHaveTextContent('¥20.00')
  expect(screen.getByText('较上一周期').closest('.metric')).toHaveTextContent('+500.0%')
  expect(screen.getByText('最高费用类别').closest('.metric')).toHaveTextContent('洗车')
  expect(screen.getByText('每公里综合成本').closest('.metric')).toHaveTextContent('¥0.30/km')
})

it('shows a continuous analysis trend with zero periods and record drill-down links', async () => {
  await db.saveVehicle({ id: 'analysis-trend', name: '分析趋势车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.settings.put({ id: 'app', selectedVehicleId: 'analysis-trend', defaultVehicleId: 'analysis-trend' })
  const base = { vehicleId: 'analysis-trend', category: 'parking' as const, excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'trend-first', amountCents: 1000, occurredAt: '2026-01-01T10:00' })
  await db.saveRecord({ ...base, id: 'trend-last', amountCents: 2000, occurredAt: '2026-01-03T10:00' })

  render(<MemoryRouter initialEntries={['/analysis?range=custom&start=2026-01-01&end=2026-01-03']}><App /></MemoryRouter>)

  expect(await screen.findByRole('img', { name: '费用趋势图' })).toBeInTheDocument()
  const zeroDay = screen.getByRole('link', { name: '2026-01-02，¥0.00，0笔' })
  expect(zeroDay).toHaveAttribute('href', expect.stringContaining('start=2026-01-02'))
  expect(zeroDay).toHaveAttribute('href', expect.stringContaining('end=2026-01-02'))
  await waitFor(() => expect(zeroDay).toHaveAttribute('href', expect.stringContaining('vehicle=analysis-trend')))
})

it('shows monthly totals, counts and honest month-over-month comparisons', async () => {
  await db.saveVehicle({ id: 'analysis-months', name: '月份对比车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.settings.put({ id: 'app', selectedVehicleId: 'analysis-months', defaultVehicleId: 'analysis-months' })
  const base = { vehicleId: 'analysis-months', category: 'parking' as const, excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'month-jan', amountCents: 1000, occurredAt: '2026-01-10T10:00' })
  await db.saveRecord({ ...base, id: 'month-feb', amountCents: 2000, occurredAt: '2026-02-10T10:00' })
  await db.saveRecord({ ...base, id: 'month-apr', amountCents: 1000, occurredAt: '2026-04-10T10:00' })

  render(<MemoryRouter initialEntries={['/analysis?range=custom&start=2026-01-01&end=2026-04-30']}><App /></MemoryRouter>)

  const panel = (await screen.findByRole('heading', { name: '月份费用对比' })).closest('.panel') as HTMLElement
  expect(await within(panel).findByRole('link', { name: '2026-03，¥0.00，0笔，较上月-¥20.00 · -100.0%' })).toBeInTheDocument()
  expect(within(panel).getByRole('link', { name: '2026-04，¥10.00，1笔，较上月暂无可比数据' })).toBeInTheDocument()
})

it('shows category and all-vehicle amounts, counts, shares and drill-down links', async () => {
  await db.saveVehicle({ id: 'analysis-car-a', name: '分析车 A', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveVehicle({ id: 'analysis-car-b', name: '分析车 B', energyType: 'electric', initialMileage: 0 })
  await db.saveVehicle({ id: 'analysis-car-empty', name: '无费用车', energyType: 'fuel', initialMileage: 0 })
  await db.settings.put({ id: 'app' })
  const base = { excludedFromEnergy: false, createdAt: '', updatedAt: '', occurredAt: '2026-01-10T10:00' }
  await db.saveRecord({ ...base, id: 'breakdown-a', vehicleId: 'analysis-car-a', category: 'parking', amountCents: 2000 })
  await db.saveRecord({ ...base, id: 'breakdown-b', vehicleId: 'analysis-car-a', category: 'wash', amountCents: 1000 })
  await db.saveRecord({ ...base, id: 'breakdown-c', vehicleId: 'analysis-car-b', category: 'parking', amountCents: 1000 })

  render(<MemoryRouter initialEntries={['/analysis?range=custom&start=2026-01-01&end=2026-01-31']}><App /></MemoryRouter>)

  const categoryLink = await screen.findByRole('link', { name: '停车，¥30.00，2笔，75%' })
  expect(categoryLink).toHaveAttribute('href', expect.stringContaining('category=parking'))
  const vehicleLink = screen.getByRole('link', { name: '分析车 A，¥30.00，2笔，75%' })
  expect(vehicleLink).toHaveAttribute('href', expect.stringContaining('vehicle=analysis-car-a'))
  expect(screen.getByRole('link', { name: '无费用车，¥0.00，0笔，0%' })).toBeInTheDocument()
})

it('updates analysis immediately when records are added, edited or removed', async () => {
  await db.saveVehicle({ id: 'analysis-live', name: '实时分析车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.settings.put({ id: 'app', selectedVehicleId: 'analysis-live', defaultVehicleId: 'analysis-live' })
  const base = { vehicleId: 'analysis-live', category: 'parking' as const, occurredAt: '2026-01-10T10:00', excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'analysis-live-a', amountCents: 1000 })
  render(<MemoryRouter initialEntries={['/analysis?range=custom&start=2026-01-01&end=2026-01-31']}><App /></MemoryRouter>)

  await waitFor(() => expect(screen.getByText('总费用').closest('.metric')).toHaveTextContent('¥10.00'))
  await db.saveRecord({ ...base, id: 'analysis-live-b', amountCents: 2000 })
  await waitFor(() => expect(screen.getByText('总费用').closest('.metric')).toHaveTextContent('¥30.00'))
  await db.saveRecord({ ...base, id: 'analysis-live-b', amountCents: 2500 })
  await waitFor(() => expect(screen.getByText('总费用').closest('.metric')).toHaveTextContent('¥35.00'))
  await db.removeRecord('analysis-live-a')
  await waitFor(() => expect(screen.getByText('总费用').closest('.metric')).toHaveTextContent('¥25.00'))
})

it('shows distinct analysis empty states without hiding valid partial results', async () => {
  const noVehicle = render(<MemoryRouter initialEntries={['/analysis']}><App /></MemoryRouter>)
  expect(screen.getByText('请先添加一辆车，再查看费用分析。')).toBeInTheDocument()
  noVehicle.unmount()

  await db.saveVehicle({ id: 'analysis-empty', name: '分析空状态车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.settings.put({ id: 'app', selectedVehicleId: 'analysis-empty', defaultVehicleId: 'analysis-empty' })
  const noRecords = render(<MemoryRouter initialEntries={['/analysis']}><App /></MemoryRouter>)
  expect(await screen.findByText('还没有用车费用记录。')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '记录第一笔费用' })).toBeInTheDocument()
  noRecords.unmount()

  await db.saveRecord({ id: 'analysis-history', vehicleId: 'analysis-empty', category: 'parking', amountCents: 1000, occurredAt: '2025-01-10T10:00', excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  render(<MemoryRouter initialEntries={['/analysis?range=custom&start=2026-01-01&end=2026-01-31']}><App /></MemoryRouter>)
  expect(await screen.findByText('当前筛选条件下没有费用记录。')).toBeInTheDocument()
  expect(screen.getByText('每公里综合成本').closest('.metric')).toHaveTextContent('至少需要两条含里程记录。')
  expect(screen.getByRole('heading', { name: '数据分析' })).toBeInTheDocument()
})

it('summarizes calendar days for the selected month and vehicle, then shows ordered day details', async () => {
  await db.saveVehicle({ id: 'calendar-fuel', name: '日历燃油车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveVehicle({ id: 'calendar-electric', name: '日历电动车', energyType: 'electric', initialMileage: 0 })
  const base = { excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'calendar-early', vehicleId: 'calendar-fuel', category: 'parking', amountCents: 1200, occurredAt: '2026-08-03T08:00', merchantOrLocation: '早高峰停车场' })
  await db.saveRecord({ ...base, id: 'calendar-late', vehicleId: 'calendar-fuel', category: 'wash', amountCents: 3800, occurredAt: '2026-08-03T18:00', merchantOrLocation: '洗车店' })
  await db.saveRecord({ ...base, id: 'calendar-other-day', vehicleId: 'calendar-fuel', category: 'toll', amountCents: 500, occurredAt: '2026-08-04T10:00' })
  await db.saveRecord({ ...base, id: 'calendar-other-vehicle', vehicleId: 'calendar-electric', category: 'charge', amountCents: 2600, occurredAt: '2026-08-03T12:00', chargeKwh: 20 })

  render(<MemoryRouter initialEntries={['/calendar?month=2026-08&day=2026-08-03']}><App /></MemoryRouter>)

  expect(await screen.findByLabelText('费用日历月份')).toHaveValue('2026-08')
  expect(screen.getByText('当月费用').closest('.metric')).toHaveTextContent('¥55.00')
  expect(screen.getByText('当月记录').closest('.metric')).toHaveTextContent('3 笔')
  expect(screen.getByText('有费用天数').closest('.metric')).toHaveTextContent('2 天')
  expect(screen.getByRole('button', { name: /2026年8月3日.*2笔.*¥50\.00/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /2026年8月3日/ })).toBeInTheDocument()
  const details = screen.getByRole('region', { name: '当天记录' })
  expect(details).toHaveTextContent('早高峰停车场')
  expect(details).toHaveTextContent('洗车店')
  expect(details.textContent!.indexOf('早高峰停车场')).toBeLessThan(details.textContent!.indexOf('洗车店'))

  fireEvent.change(screen.getByLabelText('当前车辆'), { target: { value: 'all' } })
  await waitFor(() => expect(screen.getByText('当月费用').closest('.metric')).toHaveTextContent('¥81.00'))
  expect(screen.getByRole('region', { name: '当天记录' })).toHaveTextContent('日历电动车')
})

it('returns from calendar bookkeeping and updates calendar records after editing or deleting', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-03T18:25:00').getTime())
  await db.saveVehicle({ id: 'calendar-actions', name: '日历操作车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveRecord({ id: 'calendar-edit', vehicleId: 'calendar-actions', category: 'parking', amountCents: 1200, occurredAt: '2026-08-03T08:00', merchantOrLocation: '机场停车场', excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

  render(<MemoryRouter initialEntries={['/calendar?month=2026-08&day=2026-08-03']}><App /></MemoryRouter>)

  fireEvent.click(await screen.findByRole('link', { name: '为这天记一笔' }))
  expect(await screen.findByLabelText('发生时间')).toHaveValue('2026-08-03T18:25')
  fireEvent.change(screen.getByLabelText('金额（元）'), { target: { value: '20' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并返回日历' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: '费用日历' })).toBeInTheDocument())
  expect(screen.getByText('当月费用').closest('.metric')).toHaveTextContent('¥32.00')

  fireEvent.click(screen.getByRole('button', { name: /查看记录：停车.*机场停车场/ }))
  const detail = await screen.findByRole('dialog', { name: '记录详情' })
  expect(detail).toHaveTextContent('机场停车场')
  fireEvent.click(within(detail).getByRole('button', { name: '编辑记录' }))
  fireEvent.change(screen.getByLabelText('金额（元）'), { target: { value: '30' } })
  fireEvent.click(screen.getByRole('button', { name: '保存更改' }))
  await waitFor(() => expect(screen.getByText('当月费用').closest('.metric')).toHaveTextContent('¥50.00'))

  fireEvent.click(screen.getByRole('button', { name: /查看记录：停车.*机场停车场/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: '记录详情' })).getByRole('button', { name: '删除记录' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '记录详情' })).not.toBeInTheDocument())
  expect(confirm).toHaveBeenCalled()
  expect(screen.getByText('当月费用').closest('.metric')).toHaveTextContent('¥20.00')
  confirm.mockRestore()
})

it('shows calendar-specific empty states and requires a vehicle when all vehicles has no default', async () => {
  const first = render(<MemoryRouter initialEntries={['/calendar']}><App /></MemoryRouter>)
  expect(screen.getByText('请先添加一辆车，再按日期查看费用。')).toBeInTheDocument()
  first.unmount()

  await db.saveVehicle({ id: 'calendar-empty-a', name: '无默认车 A', energyType: 'fuel', initialMileage: 0, isDefault: false })
  await db.saveVehicle({ id: 'calendar-empty-b', name: '无默认车 B', energyType: 'electric', initialMileage: 0, isDefault: false })
  const second = render(<MemoryRouter initialEntries={['/calendar']}><App /></MemoryRouter>)
  expect(await screen.findByText('还没有用车费用记录。')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('当前车辆'), { target: { value: 'all' } })
  const todayLink = screen.getByRole('link', { name: '为今天记一笔' })
  await waitFor(() => expect(todayLink).not.toHaveAttribute('href', expect.stringContaining('vehicle=')))
  fireEvent.click(todayLink)
  await waitFor(() => expect(screen.getByLabelText('所属车辆')).toHaveValue(''))
  second.unmount()

  await db.saveRecord({ id: 'calendar-history', vehicleId: 'calendar-empty-a', category: 'parking', amountCents: 1000, occurredAt: '2026-07-03T10:00', excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  render(<MemoryRouter initialEntries={['/calendar?month=2026-08']}><App /></MemoryRouter>)
  expect(await screen.findByText('本月暂无费用记录。')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '2026年8月3日，无费用记录' }))
  expect(screen.getByText('这一天暂无费用记录。')).toBeInTheDocument()
})

it('keeps calendar detail open on delete failure and restores focus after closing', async () => {
  await db.saveVehicle({ id: 'calendar-focus', name: '日历焦点车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveRecord({ id: 'calendar-focus-record', vehicleId: 'calendar-focus', category: 'parking', amountCents: 1200, occurredAt: '2026-08-03T08:00', excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const remove = vi.spyOn(db, 'removeRecord').mockRejectedValueOnce(new Error('写入失败'))

  render(<MemoryRouter initialEntries={['/calendar?month=2026-08&day=2026-08-03']}><App /></MemoryRouter>)
  const record = await screen.findByRole('button', { name: '查看记录：停车' })
  fireEvent.click(record)
  const detail = await screen.findByRole('dialog', { name: '记录详情' })
  expect(within(detail).getByRole('button', { name: '关闭' })).toHaveFocus()
  fireEvent.click(within(detail).getByRole('button', { name: '删除记录' }))
  await waitFor(() => expect(screen.getByText('删除失败，请检查本地数据后重试。')).toBeInTheDocument())
  expect(screen.getByRole('dialog', { name: '记录详情' })).toBeInTheDocument()
  fireEvent.click(within(detail).getByRole('button', { name: '关闭' }))
  await waitFor(() => expect(record).toHaveFocus())
  expect(remove).toHaveBeenCalledWith('calendar-focus-record')
})

it('shows month-aware dashboard metrics for one vehicle and active vehicle count for all vehicles', async () => {
  await db.saveVehicle({ id: 'v1', name: '首页测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveVehicle({ id: 'v2', name: '第二辆车', energyType: 'electric', initialMileage: 0 })
  await db.saveRecord({ id: 'one', vehicleId: 'v1', category: 'parking', amountCents: 2000, occurredAt: '2026-08-02T10:00', mileage: 100, excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  await db.saveRecord({ id: 'two', vehicleId: 'v1', category: 'wash', amountCents: 5000, occurredAt: '2026-08-20T10:00', mileage: 200, excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  render(<MemoryRouter><App /></MemoryRouter>)

  const dashboardMonth = await screen.findByLabelText('首页月份')
  fireEvent.change(dashboardMonth, { target: { value: '2026-08' } })
  expect(screen.getByText('本月费用').closest('.metric')).toHaveTextContent('¥70.00')
  expect(screen.getByText('本月记录').closest('.metric')).toHaveTextContent('2 笔')
  expect(screen.getByText('单公里成本').closest('.metric')).toHaveTextContent('¥0.70/km')

  fireEvent.change(screen.getByLabelText('当前车辆'), { target: { value: 'all' } })
  await waitFor(() => expect(screen.getByText('活跃车辆').closest('.metric')).toHaveTextContent('2 辆'))
})
it('applies dashboard record URL filters when opening detailed records', async () => {
  await db.saveVehicle({ id: 'v1', name: '筛选测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveRecord({ id: 'in', vehicleId: 'v1', category: 'parking', amountCents: 1200, occurredAt: '2026-08-02T10:00', excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  await db.saveRecord({ id: 'out', vehicleId: 'v1', category: 'wash', amountCents: 3300, occurredAt: '2026-09-02T10:00', excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  render(<MemoryRouter initialEntries={['/records?vehicle=v1&start=2026-08-01&end=2026-08-31&category=parking']}><App /></MemoryRouter>)

  await waitFor(() => expect(screen.getByText('记录数量').closest('.metric')).toHaveTextContent('1 笔'))
  expect(screen.getByText('总金额').closest('.metric')).toHaveTextContent('¥12.00')
  expect(screen.getByLabelText('类别筛选')).toHaveValue('parking')
  expect(screen.getByLabelText('开始日期')).toHaveValue('2026-08-01')
  expect(screen.getByLabelText('结束日期')).toHaveValue('2026-08-31')
})

it('keeps detailed-record filters in the URL model, searches category names and validates ranges', async () => {
  await db.saveVehicle({ id: 'records-a', name: '家庭用车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveVehicle({ id: 'records-b', name: '通勤电车', energyType: 'electric', initialMileage: 0 })
  const base = { vehicleId: 'records-a', excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'records-match', category: 'parking', amountCents: 1200, occurredAt: '2026-08-02T10:00', merchantOrLocation: '机场停车场' })
  await db.saveRecord({ ...base, id: 'records-out', category: 'wash', amountCents: 3000, occurredAt: '2026-08-03T10:00' })
  await db.saveRecord({ ...base, id: 'records-other-vehicle', vehicleId: 'records-b', category: 'parking', amountCents: 1500, occurredAt: '2026-08-02T10:00' })

  render(<MemoryRouter initialEntries={['/records?vehicle=records-a&query=%E5%81%9C%E8%BD%A6&category=parking&start=2026-08-01&end=2026-08-31&min=10&max=20&sort=amount-desc']}><App /></MemoryRouter>)

  await waitFor(() => expect(screen.getByLabelText('详细记录车辆')).toHaveValue('records-a'))
  expect(screen.getByLabelText('搜索记录')).toHaveValue('停车')
  expect(screen.getByLabelText('类别筛选')).toHaveValue('parking')
  expect(screen.getByLabelText('开始日期')).toHaveValue('2026-08-01')
  expect(screen.getByLabelText('结束日期')).toHaveValue('2026-08-31')
  expect(screen.getByLabelText('最低金额')).toHaveValue(10)
  expect(screen.getByLabelText('最高金额')).toHaveValue(20)
  expect(screen.getByLabelText('排序')).toHaveValue('amount-desc')
  expect(screen.getByText('记录数量').closest('.metric')).toHaveTextContent('1 笔')
  expect(screen.getByRole('button', { name: '移除关键词筛选' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '移除关键词筛选' }))
  await waitFor(() => expect(screen.getByLabelText('搜索记录')).toHaveValue(''))

  cleanup()
  render(<MemoryRouter initialEntries={['/records?start=2026-08-31&end=2026-08-01&min=20&max=10']}><App /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('开始日期不能晚于结束日期。')
  expect(screen.getByRole('alert')).toHaveTextContent('最低金额不能高于最高金额。')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
it('summarizes all matching records, sorts ties stably and loads records in pages', async () => {
  await db.saveVehicle({ id: 'records-many', name: '大量记录车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  const base = { vehicleId: 'records-many', category: 'parking' as const, excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'a-stable', amountCents: 10, occurredAt: '2026-08-01T08:00' })
  await db.saveRecord({ ...base, id: 'b-stable', amountCents: 20, occurredAt: '2026-08-01T08:00' })
  for (let index = 3; index <= 65; index += 1) await db.saveRecord({ ...base, id: `record-${String(index).padStart(2, '0')}`, amountCents: index, occurredAt: `2026-08-${String((index - 1) % 28 + 1).padStart(2, '0')}T10:00` })

  render(<MemoryRouter initialEntries={['/records?vehicle=records-many']}><App /></MemoryRouter>)

  await waitFor(() => expect(screen.getByText('记录数量').closest('.metric')).toHaveTextContent('65 笔'))
  expect(screen.getByText('总金额').closest('.metric')).toHaveTextContent('¥21.72')
  expect(screen.getByText('平均单笔金额').closest('.metric')).toHaveTextContent('¥0.33')
  expect(screen.getByText('记录日期').closest('.metric')).toHaveTextContent('2026年8月1日')
  const table = screen.getByRole('table', { name: '详细记录列表' })
  expect(within(table).getAllByRole('row')).toHaveLength(31)
  expect(within(table).getAllByRole('row')[1]).toHaveAttribute('data-record-id', 'a-stable')
  expect(screen.getByText('已展示 30 / 共 65 条')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '加载更多记录' }))
  expect(within(table).getAllByRole('row')).toHaveLength(61)
  fireEvent.click(screen.getByRole('button', { name: '加载更多记录' }))
  expect(within(table).getAllByRole('row')).toHaveLength(66)
  expect(screen.queryByRole('button', { name: '加载更多记录' })).not.toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('排序'), { target: { value: 'amount-desc' } })
  expect(screen.getByText('已展示 30 / 共 65 条')).toBeInTheDocument()
  expect(within(table).getAllByRole('row')[1]).toHaveAttribute('data-record-id', 'record-65')
})

it('opens complete detailed-record information and restores focus after closing', async () => {
  await db.saveVehicle({ id: 'detail-car', name: '详情测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveRecord({ id: 'detail-record', vehicleId: 'detail-car', category: 'fuel', amountCents: 3560, occurredAt: '2026-08-08T09:30', mileage: 12345, merchantOrLocation: '测试加油站', notes: '完整字段验收', fuelLiters: 5.5, fuelGrade: '95号', unitPriceCents: 647, isFullFuel: true, excludedFromEnergy: false, createdAt: '2026-08-08T09:00:00.000Z', updatedAt: '2026-08-08T09:30:00.000Z' })
  render(<MemoryRouter initialEntries={['/records?vehicle=detail-car']}><App /></MemoryRouter>)

  const view = await within(await screen.findByRole('table', { name: '详细记录列表' })).findByRole('button', { name: '查看2026年8月8日加油记录' })
  fireEvent.click(view)
  const detail = await screen.findByRole('dialog', { name: '记录详情' })
  expect(detail).toHaveTextContent('详情测试车')
  expect(detail).toHaveTextContent('加油')
  expect(detail).toHaveTextContent('¥35.60')
  expect(detail).toHaveTextContent('12345 km')
  expect(detail).toHaveTextContent('测试加油站')
  expect(detail).toHaveTextContent('完整字段验收')
  expect(detail).toHaveTextContent('5.50 L')
  expect(detail).toHaveTextContent('95号')
  expect(detail).toHaveTextContent('¥6.47/L')
  expect(detail).toHaveTextContent('已加满')
  expect(detail).toHaveTextContent('创建时间')
  expect(detail).toHaveTextContent('更新时间')
  expect(screen.getByRole('heading', { name: '记录详情' })).toHaveFocus()

  fireEvent.click(within(detail).getByRole('button', { name: '关闭' }))
  await waitFor(() => expect(view).toHaveFocus())
})

it('edits from detail and handles detailed-record deletion failure without losing list state', async () => {
  await db.saveVehicle({ id: 'manage-car', name: '管理测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  const base = { vehicleId: 'manage-car', category: 'parking' as const, excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  await db.saveRecord({ ...base, id: 'manage-target', amountCents: 1200, occurredAt: '2026-08-08T09:30', merchantOrLocation: '目标停车场' })
  await db.saveRecord({ ...base, id: 'manage-other', amountCents: 2000, occurredAt: '2026-08-09T09:30' })
  const confirm = vi.spyOn(window, 'confirm').mockImplementation(message => { expect(message).toContain('2026年8月8日'); expect(message).toContain('管理测试车'); expect(message).toContain('停车'); expect(message).toContain('¥15.00'); return true })

  render(<MemoryRouter initialEntries={['/records?vehicle=manage-car&sort=amount-desc']}><App /></MemoryRouter>)
  const table = await screen.findByRole('table', { name: '详细记录列表' })
  const targetRow = table.querySelector('[data-record-id="manage-target"]') as HTMLElement
  fireEvent.click(within(targetRow).getByRole('button', { name: '查看2026年8月8日停车记录' }))
  const detail = await screen.findByRole('dialog', { name: '记录详情' })
  fireEvent.click(within(detail).getByRole('button', { name: '编辑记录' }))
  const edit = await screen.findByRole('dialog', { name: '编辑记录' })
  fireEvent.change(within(edit).getByLabelText('金额（元）'), { target: { value: '15' } })
  fireEvent.click(within(edit).getByRole('button', { name: '保存更改' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('记录已更新。'))
  expect(screen.getByLabelText('排序')).toHaveValue('amount-desc')
  expect(table.querySelectorAll('tbody tr')[0]).toHaveAttribute('data-record-id', 'manage-other')

  fireEvent.click(within(targetRow).getByRole('button', { name: '查看2026年8月8日停车记录' }))
  const failedDetail = await screen.findByRole('dialog', { name: '记录详情' })
  const remove = vi.spyOn(db, 'removeRecord').mockRejectedValueOnce(new Error('写入失败'))
  fireEvent.click(within(failedDetail).getByRole('button', { name: '删除记录' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('删除失败，请检查本地数据后重试。'))
  expect(screen.getByRole('dialog', { name: '记录详情' })).toBeInTheDocument()
  remove.mockRestore()
  fireEvent.click(within(screen.getByRole('dialog', { name: '记录详情' })).getByRole('button', { name: '删除记录' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '记录详情' })).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByText('记录数量').closest('.metric')).toHaveTextContent('1 笔'))
  expect(confirm).toHaveBeenCalledTimes(2)
})

it('copies a record through a prefilled form and creates a new independent record', async () => {
  await db.saveVehicle({ id: 'copy-car', name: '复制测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveRecord({ id: 'copy-source', vehicleId: 'copy-car', category: 'fuel', amountCents: 3570, occurredAt: '2026-08-08T09:30', mileage: 8888, merchantOrLocation: '复制加油站', notes: '复制备注', fuelLiters: 5.5, fuelGrade: '95号', unitPriceCents: 649, isFullFuel: true, excludedFromEnergy: true, createdAt: '2026-08-08T09:00:00.000Z', updatedAt: '2026-08-08T09:30:00.000Z' })
  render(<MemoryRouter initialEntries={['/records?vehicle=copy-car']}><App /></MemoryRouter>)

  const table = await screen.findByRole('table', { name: '详细记录列表' })
  fireEvent.click(within(table).getByRole('button', { name: '查看2026年8月8日加油记录' }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: '记录详情' })).getByRole('button', { name: '复制为新记录' }))
  const copy = await screen.findByRole('dialog', { name: '复制记录' })
  expect(within(copy).getByLabelText('所属车辆')).toHaveValue('copy-car')
  expect(within(copy).getByRole('button', { name: '加油' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(copy).getByLabelText('金额（元）')).toHaveValue(35.7)
  expect(within(copy).getByLabelText('当前里程（km）')).toHaveValue(8888)
  expect(within(copy).getByLabelText('加油量（升）')).toHaveValue(5.5)
  expect(within(copy).getByLabelText('油品标号')).toHaveValue('95号')
  expect(within(copy).getByLabelText('加油站或地点')).toHaveValue('复制加油站')
  expect(within(copy).getByLabelText('备注')).toHaveValue('复制备注')
  fireEvent.change(within(copy).getByLabelText('金额（元）'), { target: { value: '40' } })
  fireEvent.click(within(copy).getByRole('button', { name: '保存副本' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已创建副本。'))
  const records = await db.records.toArray()
  const created = records.find(record => record.id !== 'copy-source')!
  expect(records).toHaveLength(2)
  expect(created.id).not.toBe('copy-source')
  expect(created.amountCents).toBe(4000)
  expect(created.occurredAt).not.toBe('2026-08-08T09:30')
  expect(created.createdAt).not.toBe('2026-08-08T09:00:00.000Z')
  expect(created.fuelLiters).toBe(5.5)
  expect(created.fuelGrade).toBe('95号')
  expect(created.excludedFromEnergy).toBe(true)
})

it('reveals and temporarily highlights a newly created record beyond the first result page', async () => {
  await db.saveVehicle({ id: 'highlight-car', name: '高亮测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  const base = { vehicleId: 'highlight-car', category: 'parking' as const, amountCents: 1000, excludedFromEnergy: false, createdAt: '', updatedAt: '' }
  for (let index = 1; index <= 30; index += 1) await db.saveRecord({ ...base, id: `highlight-${index}`, occurredAt: `2026-08-${String(index).padStart(2, '0')}T08:00` })
  await db.saveRecord({ ...base, id: 'highlight-target', amountCents: 2500, occurredAt: '2026-09-01T08:00' })

  render(<MemoryRouter initialEntries={['/records?vehicle=highlight-car&highlight=highlight-target']}><App /></MemoryRouter>)
  const table = await screen.findByRole('table', { name: '详细记录列表' })
  expect(screen.getByRole('status')).toHaveTextContent('已定位新记录。')
  await waitFor(() => expect(table.querySelector('[data-record-id="highlight-target"]')).not.toBeNull())
  const target = table.querySelector('[data-record-id="highlight-target"]')
  expect(target).not.toBeNull()
  expect(screen.getByText('已展示 31 / 共 31 条')).toBeInTheDocument()
  expect(target).toHaveTextContent('¥25.00')
})

it('gives a clear empty detailed-record state with a path to create the first record', () => {
  render(<MemoryRouter initialEntries={['/records']}><App /></MemoryRouter>)
  expect(screen.getByText('没有符合条件的记录。')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '记一笔' })).toHaveAttribute('href', '/record')
})

it('shows a six-month dashboard trend and expands expense categories on demand', async () => {
  await db.saveVehicle({ id: 'v1', name: '趋势测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  for (const [index, category] of ['fuel', 'charge', 'parking', 'wash', 'maintenance', 'repair'].entries()) await db.saveRecord({ id: `record-${index}`, vehicleId: 'v1', category: category as ExpenseCategory, amountCents: (index + 1) * 1000, occurredAt: `2026-08-${String(index + 1).padStart(2, '0')}T10:00`, excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  render(<MemoryRouter><App /></MemoryRouter>)

  fireEvent.change(await screen.findByLabelText('首页月份'), { target: { value: '2026-08' } })
  expect(screen.getByRole('img', { name: '近六个月费用趋势图' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '显示全部类别' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '加油' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '显示全部类别' }))
  expect(screen.getByRole('link', { name: '加油' })).toBeInTheDocument()
})
it('shows a vehicle-specific energy summary without mixing other vehicles', async () => {
  await db.saveVehicle({ id: 'v1', name: '能耗首页车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveRecord({ id: 'start', vehicleId: 'v1', category: 'fuel', amountCents: 20000, occurredAt: '2026-07-30T10:00', mileage: 1000, fuelLiters: 40, isFullFuel: true, excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  await db.saveRecord({ id: 'end', vehicleId: 'v1', category: 'fuel', amountCents: 16000, occurredAt: '2026-08-20T10:00', mileage: 1500, fuelLiters: 40, isFullFuel: true, excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  render(<MemoryRouter><App /></MemoryRouter>)

  fireEvent.change(await screen.findByLabelText('首页月份'), { target: { value: '2026-08' } })
  expect(screen.getByRole('heading', { name: '车辆与能耗摘要' })).toBeInTheDocument()
  expect(screen.getByText('平均油耗：8.00 L/100km')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '查看能耗详情' })).toHaveAttribute('href', '/energy')
})
it('opens a recent record detail and provides an edit entry from the dashboard', async () => {
  await db.saveVehicle({ id: 'v1', name: '最近记录车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveRecord({ id: 'recent', vehicleId: 'v1', category: 'parking', amountCents: 1200, occurredAt: '2026-08-20T10:00', merchantOrLocation: '机场停车场', notes: '出差', excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  render(<MemoryRouter><App /></MemoryRouter>)

  fireEvent.click(await screen.findByRole('button', { name: /查看记录：停车/ }))
  const detail = screen.getByRole('dialog', { name: '记录详情' })
  expect(detail).toHaveTextContent('机场停车场')
  expect(detail).toHaveTextContent('¥12.00')
  fireEvent.click(within(detail).getByRole('button', { name: '编辑记录' }))
  expect(screen.getByRole('dialog', { name: '编辑记录' })).toBeInTheDocument()
  expect(screen.getByLabelText('金额（元）')).toHaveValue(12)
})

it('shows a first-use dashboard action when there are no vehicles', () => {
  render(<MemoryRouter><App /></MemoryRouter>)
  expect(screen.getByText('先添加一辆车，开始记录用车费用。')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '新增第一辆车' })).toHaveAttribute('href', '/vehicles')
})

it('groups record scenes by vehicle type and shows the current mileage as a reference', async () => {
  await db.saveVehicle({ id: 'fuel', name: '燃油记账车', energyType: 'fuel', initialMileage: 800, isDefault: true })
  await db.saveRecord({ id: 'old', vehicleId: 'fuel', category: 'parking', amountCents: 1000, occurredAt: '2026-08-01T10:00', mileage: 1000, excludedFromEnergy: false, createdAt: '', updatedAt: '' })
  render(<MemoryRouter initialEntries={['/record']}><App /></MemoryRouter>)

  await waitFor(() => expect(screen.getByLabelText('所属车辆')).toHaveValue('fuel'))
  expect(screen.getByText(/最高里程参考：1000 km/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '加油' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '充电' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '停车' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: '加油' }))
  expect(screen.getByLabelText('加油量（升）')).toBeInTheDocument()
  expect(screen.queryByLabelText('充电量（kWh）')).not.toBeInTheDocument()
})

it('guides the user to add a vehicle instead of showing an unusable record form', () => {
  render(<MemoryRouter initialEntries={['/record']}><App /></MemoryRouter>)
  expect(screen.getByText('请先新增车辆后再记账。')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '新增车辆' })).toHaveAttribute('href', '/vehicles')
  expect(screen.queryByLabelText('金额（元）')).not.toBeInTheDocument()
})

it('calculates energy amount and unit price from the last edited field', async () => {
  await db.saveVehicle({ id: 'hybrid', name: '插混记账车', energyType: 'hybrid', initialMileage: 0, isDefault: true })
  render(<MemoryRouter initialEntries={['/record']}><App /></MemoryRouter>)

  fireEvent.click(await screen.findByRole('button', { name: '加油' }))
  fireEvent.change(screen.getByLabelText('加油量（升）'), { target: { value: '10' } })
  fireEvent.change(screen.getByLabelText('单价（元/升）'), { target: { value: '7.23' } })
  expect(screen.getByLabelText('金额（元）')).toHaveValue(72.3)
  fireEvent.change(screen.getByLabelText('金额（元）'), { target: { value: '80' } })
  expect(screen.getByLabelText('单价（元/升）')).toHaveValue(8)

  fireEvent.click(screen.getByRole('button', { name: '充电' }))
  expect(screen.getByLabelText('充电方式')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('充电方式'), { target: { value: '公共直流快充' } })
  expect(screen.getByLabelText('充电方式')).toHaveValue('公共直流快充')
  expect(screen.getByText(/未充满记录仍可参与完整区间内的累计/)).toBeInTheDocument()
})

it('shows field-level validation and focuses the first invalid input', async () => {
  await db.saveVehicle({ id: 'fuel', name: '校验车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  render(<MemoryRouter initialEntries={['/record']}><App /></MemoryRouter>)

  await waitFor(() => expect(screen.getByLabelText('所属车辆')).toHaveValue('fuel'))
  const form = (await screen.findByLabelText('金额（元）')).closest('form')!
  fireEvent.submit(form)
  expect(screen.getByText('金额必须大于 0。')).toBeInTheDocument()
  const amountInput = screen.getByRole('spinbutton', { name: /金额（元）/ })
  expect(amountInput).toHaveFocus()
  expect(amountInput).toHaveAttribute('aria-invalid', 'true')
})

it('keeps the vehicle and category when saving another record and preserves input on failure', async () => {
  await db.saveVehicle({ id: 'fuel', name: '连续记账车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  render(<MemoryRouter initialEntries={['/record']}><App /></MemoryRouter>)

  fireEvent.change(await screen.findByLabelText('金额（元）'), { target: { value: '20' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并再记一笔' }))
  await waitFor(() => expect(screen.getByText('保存成功，可以继续记账。')).toBeInTheDocument())
  expect(screen.getByLabelText('所属车辆')).toHaveValue('fuel')
  expect(screen.getByRole('button', { name: '停车' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('金额（元）')).toHaveValue(null)

  const failure = vi.spyOn(db, 'saveRecord').mockRejectedValueOnce(new Error('写入失败'))
  fireEvent.change(screen.getByLabelText('金额（元）'), { target: { value: '30' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并查看记录' }))
  await waitFor(() => expect(screen.getByText('保存失败，请检查本地数据后重试。')).toBeInTheDocument())
  expect(screen.getByLabelText('金额（元）')).toHaveValue(30)
  failure.mockRestore()
})

it('applies valid vehicle, category and date parameters when entering the record page', async () => {
  await db.saveVehicle({ id: 'default', name: '默认车辆', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveVehicle({ id: 'hybrid', name: '参数插混车', energyType: 'hybrid', initialMileage: 0 })
  render(<MemoryRouter initialEntries={['/record?vehicle=hybrid&category=charge&date=2026-08-10']}><App /></MemoryRouter>)

  await waitFor(() => expect(screen.getByLabelText('所属车辆')).toHaveValue('hybrid'))
  expect(screen.getByRole('button', { name: '充电' })).toHaveAttribute('aria-pressed', 'true')
  expect((screen.getByLabelText('发生时间') as HTMLInputElement).value).toMatch(/^2026-08-10T\d{2}:\d{2}$/)
})
it('provides vehicle-aware energy controls and a twelve-month default range', async () => {
  await db.saveVehicle({ id: 'fuel', name: '燃油测试车', energyType: 'fuel', initialMileage: 0, isDefault: true })
  await db.saveVehicle({ id: 'electric', name: '纯电测试车', energyType: 'electric', initialMileage: 0 })
  render(<MemoryRouter initialEntries={['/energy']}><App /></MemoryRouter>)

  await waitFor(() => expect(screen.getByRole('heading', { name: '能耗统计' })).toBeInTheDocument())
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
  const basis = await screen.findByRole('region', { name: '区间计算依据' })
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
  fireEvent.click(screen.getByRole('button', { name: '保存更改' }))
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
