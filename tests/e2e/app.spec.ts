import { devices, expect, test } from '@playwright/test'

test('can navigate all primary modules and create a vehicle', async ({ page }) => {
  await page.goto('/')
  for (const label of ['首页总览', '用车记账', '费用日历', '数据分析', '详细记录', '能耗统计', '车辆管理']) await expect(page.getByRole('link', { name: label })).toBeVisible()
  await page.getByRole('link', { name: '车辆管理' }).click()
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('测试燃油车')
  await page.getByLabel('初始里程（km）').fill('1000')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await expect(page.getByText('测试燃油车 · 默认车辆')).toBeVisible()
  await page.getByRole('button', { name: '＋记一笔' }).click()
  await page.getByLabel('金额（元）').fill('20')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await expect(page.getByText('共 1 笔，合计 ¥20.00')).toBeVisible()
})

test('sorts detailed records by date ascending by default and can switch to descending', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('排序测试车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()

  await page.getByRole('button', { name: '＋记一笔' }).click()
  await page.getByLabel('金额（元）').fill('10')
  await page.getByLabel('发生时间').fill('2026-01-02T12:00')
  await page.getByRole('button', { name: '保存并查看记录' }).click()

  await page.getByRole('button', { name: '＋记一笔' }).click()
  await page.getByLabel('金额（元）').fill('20')
  await page.getByLabel('发生时间').fill('2026-01-01T12:00')
  await page.getByRole('button', { name: '保存并查看记录' }).click()

  await expect(page.locator('tbody tr').first()).toContainText('2026年1月1日')
  await page.getByLabel('排序').selectOption('date-desc')
  await expect(page.locator('tbody tr').first()).toContainText('2026年1月2日')

  await page.getByLabel('最低金额').fill('15')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: '清除筛选' }).click()
  await expect(page.getByLabel('最低金额')).toHaveValue('')
  await expect(page.getByLabel('排序')).toHaveValue('date-asc')
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(page.locator('tbody tr').first()).toContainText('2026年1月1日')
})

test('saves and restores a selected fuel grade', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('油品测试车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.getByRole('button', { name: '＋记一笔' }).click()
  await page.getByRole('button', { name: '加油' }).click()
  await page.getByLabel('金额（元）').fill('100')
  await page.getByLabel('当前里程（km）').fill('1000')
  await page.getByLabel('加油量（升）').fill('10')
  await page.getByLabel('油品标号').selectOption('95号')
  await expect(page.getByLabel('油品标号')).toHaveValue('95号')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await page.getByRole('button', { name: '编辑' }).click()
  await expect(page.getByLabel('油品标号')).toHaveValue('95号')
})

test('adapts energy scenes by vehicle type and supports keyboard scene selection', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('纯电记账车')
  await page.getByLabel('能源类型').selectOption('electric')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.getByRole('button', { name: '＋记一笔' }).click()

  await expect(page.getByRole('button', { name: '加油' })).toHaveCount(0)
  const charge = page.getByRole('button', { name: '充电' })
  await charge.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('充电量（kWh）')).toBeVisible()
  await page.getByLabel('充电量（kWh）').fill('20')
  await page.getByLabel('单价（元/kWh）').fill('1.5')
  await expect(page.getByLabel('金额（元）')).toHaveValue('30.00')
  await page.getByLabel('当前里程（km）').fill('100')
  await page.getByLabel('充电方式').selectOption('公共直流快充')
  await page.getByRole('button', { name: '保存并再记一笔' }).click()
  await expect(page.getByText('保存成功，可以继续记账。')).toBeVisible()
  await expect(page.getByLabel('金额（元）')).toHaveValue('')
})

test('keeps the primary record fields from overlapping at a medium desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 })
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('布局测试车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.getByRole('button', { name: '＋记一笔' }).click()

  const [amount, date, mileage] = await Promise.all([
    page.getByLabel('金额（元）').boundingBox(),
    page.getByLabel('发生时间').boundingBox(),
    page.getByLabel('当前里程（km）').boundingBox(),
  ])
  expect(amount).not.toBeNull()
  expect(date).not.toBeNull()
  expect(mileage).not.toBeNull()
  expect(amount!.x + amount!.width).toBeLessThanOrEqual(date!.x)
  expect(amount!.height).toBe(date!.height)
  expect(date!.height).toBe(mileage!.height)
  expect(date!.x + date!.width).toBeLessThanOrEqual(mileage!.x)

  const [place, notes] = await Promise.all([
    page.getByLabel('停车场或地点').boundingBox(),
    page.getByLabel('备注').boundingBox(),
  ])
  expect(place).not.toBeNull()
  expect(notes).not.toBeNull()
  expect(place!.y).toBe(notes!.y)
  expect(place!.height).toBe(notes!.height)

  const textStyles = await Promise.all([
    page.getByLabel('金额（元）').evaluate(element => ({ size: getComputedStyle(element).fontSize, weight: getComputedStyle(element).fontWeight })),
    page.getByLabel('发生时间').evaluate(element => ({ size: getComputedStyle(element).fontSize, weight: getComputedStyle(element).fontWeight })),
    page.getByLabel('当前里程（km）').evaluate(element => ({ size: getComputedStyle(element).fontSize, weight: getComputedStyle(element).fontWeight })),
  ])
  expect(textStyles[0]).toEqual(textStyles[1])
  expect(textStyles[1]).toEqual(textStyles[2])
})

test('lays out the expense calendar without overlap on desktop and narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('日历布局车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.getByRole('link', { name: '费用日历' }).click()

  await expect(page.getByLabel('费用日历月份')).toBeVisible()
  const desktopPanels = page.locator('.calendar-layout > .panel')
  const [calendarPanel, detailPanel] = await Promise.all([desktopPanels.nth(0).boundingBox(), desktopPanels.nth(1).boundingBox()])
  expect(calendarPanel).not.toBeNull()
  expect(detailPanel).not.toBeNull()
  expect(calendarPanel!.x + calendarPanel!.width).toBeLessThanOrEqual(detailPanel!.x)

  const firstDay = await page.locator('.calendar-day').first().boundingBox()
  const secondDay = await page.locator('.calendar-day').nth(1).boundingBox()
  expect(firstDay).not.toBeNull()
  expect(secondDay).not.toBeNull()
  expect(firstDay!.x + firstDay!.width).toBeLessThanOrEqual(secondDay!.x)

  await page.setViewportSize({ width: 600, height: 900 })
  const [narrowCalendar, narrowDetail] = await Promise.all([desktopPanels.nth(0).boundingBox(), desktopPanels.nth(1).boundingBox()])
  expect(narrowCalendar).not.toBeNull()
  expect(narrowDetail).not.toBeNull()
  expect(narrowCalendar!.y + narrowCalendar!.height).toBeLessThanOrEqual(narrowDetail!.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('records, edits and deletes a dated expense from the calendar', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('日历流程车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.getByRole('button', { name: '＋记一笔' }).click()
  await page.getByLabel('金额（元）').fill('12')
  await page.getByLabel('发生时间').fill('2026-08-03T08:00')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await page.getByRole('link', { name: '费用日历' }).click()
  await page.getByLabel('费用日历月份').fill('2026-08')
  await page.getByRole('button', { name: /2026年8月3日.*1笔.*¥12\.00/ }).click()
  await expect(page.getByRole('region', { name: '当天记录' })).toContainText('¥12.00')

  await page.getByRole('link', { name: '为这天记一笔' }).click()
  expect(await page.getByLabel('发生时间').inputValue()).toMatch(/^2026-08-03T\d{2}:\d{2}$/)
  await page.getByLabel('金额（元）').fill('20')
  await page.getByRole('button', { name: '保存并返回日历' }).click()
  await expect(page.getByText('当月费用').locator('..')).toContainText('¥32.00')

  await page.getByRole('button', { name: /查看记录：停车/ }).first().click()
  await page.getByRole('dialog', { name: '记录详情' }).getByRole('button', { name: '编辑记录' }).click()
  const editDialog = page.getByRole('dialog', { name: '编辑记录' })
  await editDialog.getByLabel('金额（元）').fill('30')
  await editDialog.getByRole('button', { name: '保存更改' }).click()
  await expect(page.getByText('当月费用').locator('..')).toContainText('¥50.00')

  await page.getByRole('button', { name: /查看记录：停车/ }).first().click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('dialog', { name: '记录详情' }).getByRole('button', { name: '删除记录' }).click()
  await expect(page.getByText('当月费用').locator('..')).toContainText('¥20.00')
})

for (const deviceName of ['iPhone 14', 'Galaxy S9+']) {
  const { defaultBrowserType: _defaultBrowserType, ...device } = devices[deviceName]

  test.describe(`mobile calendar acceptance: ${deviceName}`, () => {
    test.use(device)

    test('supports the calendar bookkeeping flow without horizontal overflow', async ({ page }) => {
      await page.goto('/vehicles')
      await page.getByRole('button', { name: '新增车辆' }).click()
      await page.getByLabel('车辆名称').fill(`${deviceName} 测试车`)
      await page.getByLabel('初始里程（km）').fill('0')
      await page.getByRole('button', { name: '保存车辆' }).click()

      await page.getByRole('button', { name: '＋记一笔' }).click()
      await page.getByLabel('金额（元）').fill('18')
      await page.getByLabel('发生时间').fill('2026-09-04T08:00')
      await page.getByRole('button', { name: '保存并查看记录' }).click()
      await page.getByRole('link', { name: '费用日历' }).click()
      await page.getByLabel('费用日历月份').fill('2026-09')

      const panels = page.locator('.calendar-layout > .panel')
      const [calendarPanel, detailPanel] = await Promise.all([panels.nth(0).boundingBox(), panels.nth(1).boundingBox()])
      expect(calendarPanel).not.toBeNull()
      expect(detailPanel).not.toBeNull()
      expect(calendarPanel!.y + calendarPanel!.height).toBeLessThanOrEqual(detailPanel!.y)
      await expect(page.getByRole('button', { name: /2026年9月4日.*1笔.*¥18\.00/ })).toBeVisible()
      await page.getByRole('button', { name: /2026年9月4日.*1笔.*¥18\.00/ }).click()
      await expect(page.getByRole('region', { name: '当天记录' })).toContainText('¥18.00')

      await page.getByRole('link', { name: '为这天记一笔' }).click()
      await page.getByLabel('金额（元）').fill('12')
      await page.getByRole('button', { name: '保存并返回日历' }).click()
      await expect(page.getByText('当月费用').locator('..')).toContainText('¥30.00')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
  })
}
