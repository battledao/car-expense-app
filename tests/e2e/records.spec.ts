import { devices, expect, test, type Page } from '@playwright/test'

async function createVehicle(page: Page, vehicleName = '详细记录验收车') {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill(vehicleName)
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
}

async function createRecord(page: Page, vehicleName = '详细记录验收车') {
  await createVehicle(page, vehicleName)
  await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
  await page.getByLabel('金额（元）').fill('12')
  await page.getByLabel('发生时间').fill('2026-09-04T08:00')
  await page.getByLabel('停车场或地点').fill('测试停车场')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
}

test('uses a semantic table on desktop detailed records', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await createRecord(page)

  await expect(page.locator('.records-table')).toBeVisible()
  await expect(page.locator('.records-cards')).toBeHidden()
  const table = page.getByRole('table', { name: '详细记录列表' })
  await expect(table).toContainText('¥12.00')
  await expect(table.getByRole('columnheader', { name: '操作' })).toHaveCount(0)
  await expect(table.getByRole('button', { name: /编辑|删除|复制/ })).toHaveCount(0)
  await table.locator('tbody tr').first().locator('td').nth(1).click()
  const detail = page.getByRole('dialog', { name: '记录详情' })
  await expect(detail.getByRole('button', { name: '编辑记录' })).toBeVisible()
  await expect(detail.getByRole('button', { name: '复制为新记录' })).toBeVisible()
  await expect(detail.locator('.record-detail-danger')).toContainText('危险操作')
  await expect(detail.getByRole('button', { name: '删除记录' })).toBeVisible()
})

test('shows the vehicle-first empty state with an entry to add a vehicle', async ({ page }) => {
  await page.goto('/records')

  const empty = page.locator('.record-empty')
  await expect(empty).toContainText('还没有车辆，请先新增车辆后再记录费用。')
  await expect(empty.getByRole('link', { name: '新增车辆', exact: true })).toHaveAttribute('href', '/vehicles')
})

test('shows the first-record entry when a vehicle has no expense records', async ({ page }) => {
  await createVehicle(page, '无记录验收车')
  await page.goto('/records')

  const empty = page.locator('.record-empty')
  await expect(empty).toContainText('还没有费用记录，先记录第一笔费用吧。')
  const firstRecord = empty.getByRole('link', { name: '记录第一笔费用', exact: true })
  await expect(firstRecord).toHaveAttribute('href', /\/record(?:\?vehicle=[^&]+)?$/)
  await firstRecord.click()
  await expect(page).toHaveURL(/\/record(?:\?vehicle=[^&]+)?$/)
  await expect(page.getByText('记账场景', { exact: true })).toBeVisible()
})

test('lets people clear a no-result filter, retain a new-record entry, and return to unfiltered results', async ({ page }) => {
  await createRecord(page, '筛选空状态验收车')
  await page.goto('/records')
  await page.getByRole('button', { name: /^筛选/ }).click()
  const drawer = page.getByRole('dialog', { name: '筛选与排序' })
  await drawer.getByLabel('类别筛选').selectOption('wash')
  await drawer.getByRole('button', { name: '查看 0 条记录', exact: true }).click()

  const empty = page.locator('.record-empty')
  await expect(empty).toContainText('当前筛选条件下没有符合条件的记录。')
  await expect(empty.getByRole('link', { name: '记一笔', exact: true })).toHaveAttribute('href', /\/record(?:\?vehicle=[^&]+)?$/)
  await page.goBack()

  await expect(page).not.toHaveURL(/category=wash/)
  await expect(page.getByRole('table', { name: '详细记录列表' })).toContainText('¥12.00')

  await page.getByRole('button', { name: /^筛选/ }).click()
  await page.getByRole('dialog', { name: '筛选与排序' }).getByLabel('类别筛选').selectOption('wash')
  await page.getByRole('dialog', { name: '筛选与排序' }).getByRole('button', { name: '查看 0 条记录', exact: true }).click()
  await empty.getByRole('button', { name: '清除筛选', exact: true }).click()
  await expect(page).not.toHaveURL(/category=wash/)
  await expect(page.getByRole('table', { name: '详细记录列表' })).toContainText('¥12.00')
  await page.goBack()
  await expect(page).not.toHaveURL(/category=wash/)
  await expect(page.getByRole('table', { name: '详细记录列表' })).toContainText('¥12.00')
})
test('switches to record cards at the 767px mobile-shell breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 900 })
  await createRecord(page, '断点验收车')

  await expect(page.locator('.mobile-nav')).toBeVisible()
  await expect(page.locator('.records-cards')).toBeVisible()
  await expect(page.locator('.records-table')).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
for (const deviceName of ['iPhone 14', 'Galaxy S9+']) {
  const { defaultBrowserType: _defaultBrowserType, ...device } = devices[deviceName]

  test.describe('mobile detailed-record acceptance: ' + deviceName, () => {
    test.use(device)

    test('shows readable detail-entry cards without inline actions and no horizontal overflow', async ({ page }) => {
      await createRecord(page, deviceName + ' 详细记录车')

      await expect(page.locator('.records-cards')).toBeVisible()
      await expect(page.locator('.records-table')).toBeHidden()
      const card = page.locator('.record-card').first()
      await expect(card).toContainText('测试停车场')
      await expect(card.locator('.record-card-actions button')).toHaveCount(0)
      const view = card.getByRole('button', { name: /查看2026年9月4日停车记录/ })
      expect((await view.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      await view.click()
      const detail = page.getByRole('dialog', { name: '记录详情' })
      await expect(detail).toBeVisible()
      await expect(detail.getByRole('button', { name: '编辑记录' })).toBeVisible()
      await expect(detail.getByRole('button', { name: '复制为新记录' })).toBeVisible()
      await expect(detail.getByRole('button', { name: '删除记录' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
  })
}
