import { expect, test, type Page } from '@playwright/test'

async function seedRecentRecords(page: Page) {
  await page.goto('/')
  await page.getByRole('heading', { name: '首页总览' }).waitFor()
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('car-expense-app')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction(['vehicles', 'records', 'settings'], 'readwrite')
    const now = new Date().toISOString()
    transaction.objectStore('vehicles').put({ id: 'dashboard-v21-primary', name: '家庭通勤车', energyType: 'fuel', initialMileage: 0, isDefault: true, createdAt: now, updatedAt: now })
    transaction.objectStore('vehicles').put({ id: 'dashboard-v21-long', name: '周末跨城出行超长车辆名称', energyType: 'electric', initialMileage: 0, isDefault: false, createdAt: now, updatedAt: now })
    const records = [
      ['dashboard-v21-1', 'dashboard-v21-long', 'toll', 123456789, '2026-09-12T23:59'],
      ['dashboard-v21-2', 'dashboard-v21-primary', 'maintenance', 456700, '2026-09-11T08:05'],
      ['dashboard-v21-3', 'dashboard-v21-long', 'parking', 1200, '2026-09-10T21:51'],
      ['dashboard-v21-4', 'dashboard-v21-primary', 'wash', 3600, '2026-09-09T09:30'],
      ['dashboard-v21-5', 'dashboard-v21-long', 'fine', 20000, '2026-09-08T18:20'],
      ['dashboard-v21-6', 'dashboard-v21-primary', 'insurance', 300000, '2026-09-07T07:15'],
    ]
    for (const [id, vehicleId, category, amountCents, occurredAt] of records) transaction.objectStore('records').put({ id, vehicleId, category, amountCents, occurredAt, excludedFromEnergy: false, createdAt: now, updatedAt: now })
    transaction.objectStore('settings').put({ id: 'app', defaultVehicleId: 'dashboard-v21-primary', selectedVehicleId: 'all' })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  })
  await page.reload()
  await expect(page.getByRole('list', { name: '最近记录列表' }).getByRole('listitem')).toHaveCount(5)
}

async function expectRecentLayout(page: Page) {
  const result = await page.locator('.dashboard-recent').evaluate(panel => {
    const rows = Array.from(panel.querySelectorAll<HTMLElement>('.dashboard-recent-row'))
    const overlaps = rows.some(row => {
      const icon = row.querySelector<HTMLElement>('.dashboard-recent-icon')!.getBoundingClientRect()
      const main = row.querySelector<HTMLElement>('.dashboard-recent-main')!.getBoundingClientRect()
      const side = row.querySelector<HTMLElement>('.dashboard-recent-side')!.getBoundingClientRect()
      const bounds = row.getBoundingClientRect()
      return icon.right > main.left + 1 || main.right > side.left + 1 || side.right > bounds.right + 1 || bounds.height < 44
    })
    const documentOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    const offenders = documentOverflow ? Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(element => { const bounds = element.getBoundingClientRect(); return bounds.right > document.documentElement.clientWidth + 1 || bounds.left < -1 || element.scrollWidth > element.clientWidth + 1 }).slice(0, 8).map(element => { const bounds = element.getBoundingClientRect(); return `${element.tagName.toLowerCase()}.${element.className}[${Math.round(bounds.left)},${Math.round(bounds.right)};${element.clientWidth}/${element.scrollWidth}]` }) : []
    return { overlaps, documentOverflow, offenders, widths: [window.innerWidth, document.documentElement.clientWidth, document.documentElement.scrollWidth, document.body.scrollWidth] }
  })
  expect(result, `viewport and document widths: ${result.widths.join('/')}; offenders: ${result.offenders.join(', ')}`).toMatchObject({ overlaps: false, documentOverflow: false, offenders: [] })
}

test('filters dashboard records by month and keeps the filter in detailed records', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('首页验收车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
  await page.getByLabel('金额（元）').fill('25')
  await page.getByLabel('发生时间').fill('2026-08-15T12:00')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await page.goto('/')
  await page.getByLabel('首页月份').fill('2026-08')

  await expect(page.getByRole('img', { name: '近六个月费用趋势图' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '车辆与能耗摘要' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '查看能耗详情' })).toHaveCount(0)
  await expect(page.locator('.metric').filter({ hasText: '本月费用' })).toContainText('¥25.00')
  await page.getByRole('link', { name: '查看本月记录' }).click()
  await page.getByRole('button', { name: /^筛选(?:，已生效 \d+ 项)?$/ }).click()
  const filters = page.getByRole('dialog', { name: '筛选与排序' })
  await expect(filters.getByLabel('开始日期')).toHaveValue('2026-08-01')
  await expect(filters.getByLabel('结束日期')).toHaveValue('2026-08-31')
  await filters.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByLabel('记录结果概览')).toContainText('1 笔 · ¥25.00')
})

test('keeps dashboard trend out of home and formats the analysis trend in yuan', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('趋势金额测试车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
  await page.getByLabel('金额（元）').fill('9020')
  await page.getByLabel('发生时间').fill('2026-09-15T12:00')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await page.goto('/')
  await page.getByLabel('首页月份').fill('2026-09')

  await expect(page.getByRole('img', { name: '近六个月费用趋势图' })).toHaveCount(0)

  await page.goto('/analysis?range=all')
  const trendCard = page.getByRole('link', { name: /费用趋势/ })
  await expect(trendCard).toContainText('¥9020.00')
  await expect(trendCard).not.toContainText('902000')
  await trendCard.click()
  const analysisChart = page.getByRole('img', { name: '费用趋势图' })
  await expect(analysisChart.getByRole('application')).toContainText('¥2,500')
  await expect(analysisChart.getByRole('application')).not.toContainText('250000')
})

test('keeps the dashboard controls usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '首页总览' })).toBeVisible()
  await page.getByRole('link', { name: '新增第一辆车' }).click()
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('窄屏验收车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.goto('/')
  const dashboardHeading = page.locator('.dashboard-heading')
  await expect(dashboardHeading.getByRole('link', { name: '记一笔' })).toHaveCount(0)
  await expect(page.locator('.global-header').getByRole('button', { name: '记一笔' })).toBeVisible()
  const currentMonth = dashboardHeading.getByRole('button', { name: '本月' })
  const viewMonthRecords = dashboardHeading.getByRole('link', { name: '查看本月记录' })
  await expect(viewMonthRecords).toBeVisible()
  await expect(currentMonth).toHaveCSS('font-weight', '700')
  await expect(viewMonthRecords).toHaveCSS('font-weight', '700')
  await expect(page.getByLabel('当前车辆')).toHaveValue(/.+/)
  await expect(page.getByLabel('当前车辆')).toHaveCSS('font-weight', '700')
  await expect(page.getByText(/窄屏验收车 · \d{4}-\d{2}/)).toHaveCount(0)
  await expect(page.getByLabel('首页月份')).toBeVisible()
})

test('only renders actionable dashboard reminders and fills the empty grid space', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()) })
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('提醒验收车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
  await page.getByLabel('金额（元）').fill('20')
  await page.getByLabel('发生时间').fill('2026-08-15T12:00')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await page.goto('/')
  await page.getByLabel('首页月份').fill('2026-08')

  await expect(page.getByRole('heading', { name: '提醒' })).toHaveCount(0)
  const recentPanel = page.locator('.dashboard-recent')
  const recentGrid = recentPanel.locator('..')
  await expect.poll(async () => {
    const [panel, grid] = await Promise.all([recentPanel.boundingBox(), recentGrid.boundingBox()])
    return panel && grid ? Math.abs(panel.width - grid.width) : Number.POSITIVE_INFINITY
  }).toBeLessThanOrEqual(1)

  await page.getByLabel('首页月份').fill('2026-09')
  const reminder = page.getByRole('heading', { name: '提醒' }).locator('..')
  await expect(reminder).toContainText('本月暂无用车记录。')
  await expect(reminder.getByRole('link', { name: '记一笔' })).toHaveAttribute('href', '/record')
  expect(browserErrors).toEqual([])
})

test('keeps category composition only in analysis and naturally closes the dashboard gap', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  await seedRecentRecords(page)

  await expect(page.getByText('本月费用构成', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '显示全部类别' })).toHaveCount(0)
  const recentPanel = page.locator('.dashboard-recent')
  const comparisonPanel = page.getByRole('heading', { name: '车辆费用对比' }).locator('..')
  await expect.poll(async () => {
    const [recent, comparison] = await Promise.all([recentPanel.boundingBox(), comparisonPanel.boundingBox()])
    return recent && comparison ? comparison.y - (recent.y + recent.height) : Number.POSITIVE_INFINITY
  }).toBeLessThan(80)

  await page.getByLabel('当前车辆').selectOption('dashboard-v21-primary')
  await expect(page.getByRole('heading', { name: '车辆费用对比' })).toHaveCount(0)
  await expect(page.getByText('本月费用构成', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: '数据分析', exact: true }).click()
  await expect(page.getByRole('link', { name: /费用类别构成/ })).toBeVisible()
})

test('opens dashboard recent details with Enter and Space and keeps view-all navigation clean', async ({ page }) => {
  await seedRecentRecords(page)
  const firstRecord = page.getByRole('list', { name: '最近记录列表' }).getByRole('button').first()

  await firstRecord.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: '记录详情' })).toBeVisible()
  await page.getByRole('dialog', { name: '记录详情' }).getByRole('button', { name: '关闭' }).click()
  await expect(firstRecord).toBeFocused()

  await page.keyboard.press('Space')
  await expect(page.getByRole('dialog', { name: '记录详情' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '记录详情' })).toHaveCount(0)
  await expect(firstRecord).toBeFocused()

  await page.getByRole('link', { name: '查看全部' }).click()
  await expect(page).toHaveURL(/\/records$/)
  await expect(page.getByRole('heading', { name: '详细记录' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: '最近记录' })).toBeVisible()
})

test('keeps V1.22 dashboard records readable across required breakpoints and enlarged text', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()) })
  page.on('pageerror', error => browserErrors.push(error.message))
  await seedRecentRecords(page)

  for (const viewport of [
    { width: 320, height: 760 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
    { width: 430, height: 932 },
    { width: 767, height: 900 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await expectRecentLayout(page)
  }

  await page.setViewportSize({ width: 430, height: 932 })
  await page.addStyleTag({ content: '.dashboard-recent-category,.dashboard-recent-amount{font-size:200%!important}.dashboard-recent-vehicle,.dashboard-recent-time{font-size:150%!important}' })
  await expectRecentLayout(page)
  expect(browserErrors).toEqual([])
})
