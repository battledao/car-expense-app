import { devices, expect, test } from '@playwright/test'

test('drills into records, preserves analysis filters and reflects edits and deletes', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('分析验收车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()

  await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
  await page.getByLabel('金额（元）').fill('20')
  await page.getByLabel('发生时间').fill('2026-01-10T10:00')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await page.goto('/analysis')
  await page.getByLabel('时间范围').selectOption('custom')
  await page.getByLabel('分析开始日期').fill('2026-01-01')
  await page.getByLabel('分析结束日期').fill('2026-01-31')
  await page.getByLabel('分析类别').selectOption('parking')
  await expect(page.locator('.metric').filter({ hasText: '总费用' })).toContainText('¥20.00')

  await page.getByRole('link', { name: '停车，¥20.00，1笔，100%' }).click()
  await expect(page.getByLabel('开始日期')).toHaveValue('2026-01-01')
  await expect(page.getByLabel('结束日期')).toHaveValue('2026-01-31')
  await expect(page.getByLabel('类别筛选')).toHaveValue('parking')
  await page.getByRole('button', { name: '编辑' }).click()
  await page.getByLabel('金额（元）').fill('25')
  await page.getByRole('button', { name: '保存更改' }).click()
  await page.goBack()

  await expect(page.getByLabel('时间范围')).toHaveValue('custom')
  await expect(page.getByLabel('分析开始日期')).toHaveValue('2026-01-01')
  await expect(page.getByLabel('分析结束日期')).toHaveValue('2026-01-31')
  await expect(page.getByLabel('分析类别')).toHaveValue('parking')
  await expect(page.locator('.metric').filter({ hasText: '总费用' })).toContainText('¥25.00')

  await page.getByRole('link', { name: '停车，¥25.00，1笔，100%' }).focus()
  await page.keyboard.press('Enter')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '删除' }).click()
  await page.goBack()
  await expect(page.locator('.metric').filter({ hasText: '总费用' })).toContainText('¥0.00')
})

for (const deviceName of ['iPhone 14', 'Galaxy S9+']) {
  const { defaultBrowserType: _defaultBrowserType, ...device } = devices[deviceName]

  test.describe(`mobile analysis acceptance: ${deviceName}`, () => {
    test.use(device)

    test('keeps filters, charts and drill-down targets usable in portrait and landscape', async ({ page }) => {
      await page.goto('/vehicles')
      await page.getByRole('button', { name: '新增车辆' }).click()
      await page.getByLabel('车辆名称').fill(`${deviceName} 分析车`)
      await page.getByLabel('初始里程（km）').fill('0')
      await page.getByRole('button', { name: '保存车辆' }).click()
      await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
      await page.getByLabel('金额（元）').fill('18')
      await page.getByLabel('发生时间').fill('2026-01-10T10:00')
      await page.getByRole('button', { name: '保存并查看记录' }).click()
      await page.goto('/analysis')
      await page.getByLabel('时间范围').selectOption('custom')
      await page.getByLabel('分析开始日期').fill('2026-01-01')
      await page.getByLabel('分析结束日期').fill('2026-01-31')

      await expect(page.getByRole('img', { name: '费用趋势图' })).toBeVisible()
      const panels = page.locator('.analysis-page .grid-two').first().locator('.panel')
      const [firstPanel, secondPanel] = await Promise.all([panels.nth(0).boundingBox(), panels.nth(1).boundingBox()])
      expect(firstPanel).not.toBeNull()
      expect(secondPanel).not.toBeNull()
      expect(firstPanel!.y + firstPanel!.height).toBeLessThanOrEqual(secondPanel!.y)
      const drillDown = page.locator('.analysis-points a').first()
      expect((await drillDown.boundingBox())!.height).toBeGreaterThanOrEqual(40)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

      await page.setViewportSize({ width: 844, height: 390 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
    test('shows three-item previews and expands complete analysis details without overflow', async ({ page }) => {
      await page.goto('/vehicles')
      await page.getByRole('button', { name: '新增车辆' }).click()
      await page.getByLabel('车辆名称').fill(`${deviceName} 展开分析车`)
      await page.getByLabel('初始里程（km）').fill('0')
      await page.getByRole('button', { name: '保存车辆' }).click()

      const entries = [
        { category: '停车', amount: '10', occurredAt: '2026-01-10T10:00' },
        { category: '洗车', amount: '20', occurredAt: '2026-02-10T10:00' },
        { category: '保养', amount: '30', occurredAt: '2026-03-10T10:00' },
        { category: '维修', amount: '40', occurredAt: '2026-04-10T10:00' },
      ]
      for (const entry of entries) {
        await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
        if (entry.category !== '停车') await page.getByRole('button', { name: entry.category, exact: true }).click()
        await page.getByLabel('金额（元）').fill(entry.amount)
        await page.getByLabel('发生时间').fill(entry.occurredAt)
        await page.getByRole('button', { name: '保存并查看记录' }).click()
      }

      await page.goto('/analysis?range=custom&start=2026-01-01&end=2026-04-30')
      const trendPoints = page.locator('.analysis-points a')
      const monthPoints = page.locator('.analysis-months a')
      const categoryPoints = page.locator('.analysis-breakdown').first().getByRole('link')
      await expect(trendPoints).toHaveCount(3)
      await expect(monthPoints).toHaveCount(3)
      await expect(categoryPoints).toHaveCount(3)
      await expect(page.getByText(/其他类别/)).toContainText('1 类')

      await page.getByRole('button', { name: '查看完整趋势' }).click()
      await page.getByRole('button', { name: '查看全部月份' }).click()
      await page.getByRole('button', { name: '查看全部类别' }).click()
      await expect(trendPoints).toHaveCount(4)
      await expect(monthPoints).toHaveCount(4)
      await expect(categoryPoints).toHaveCount(4)
      await expect(page.getByRole('button', { name: '收起完整趋势' })).toHaveAttribute('aria-expanded', 'true')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
  })
}
