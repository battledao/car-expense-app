import { devices, expect, test, type Page } from '@playwright/test'

async function createRecord(page: Page, vehicleName = '详细记录验收车') {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill(vehicleName)
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  await page.getByRole('button', { name: '＋记一笔' }).click()
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
  await expect(page.getByRole('table', { name: '详细记录列表' })).toContainText('¥12.00')
})

for (const deviceName of ['iPhone 14', 'Galaxy S9+']) {
  const { defaultBrowserType: _defaultBrowserType, ...device } = devices[deviceName]

  test.describe('mobile detailed-record acceptance: ' + deviceName, () => {
    test.use(device)

    test('shows readable cards with tap-sized actions and no horizontal overflow', async ({ page }) => {
      await createRecord(page, deviceName + ' 详细记录车')

      await expect(page.locator('.records-cards')).toBeVisible()
      await expect(page.locator('.records-table')).toBeHidden()
      const card = page.locator('.record-card').first()
      await expect(card).toContainText('测试停车场')
      await expect(card.locator('.record-card-actions button')).toHaveCount(3)
      const actionSize = await card.locator('.record-card-actions button').first().boundingBox()
      expect(actionSize).not.toBeNull()
      expect(actionSize!.width).toBeGreaterThanOrEqual(44)
      expect(actionSize!.height).toBeGreaterThanOrEqual(44)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
  })
}
