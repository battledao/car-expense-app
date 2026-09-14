import { devices, expect, test } from '@playwright/test'

test('enters analysis child pages, preserves filters, and reflects record edits and deletes', async ({ page }) => {
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
  await expect(page.getByRole('img', { name: '费用趋势图' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '查看详细记录' })).toHaveCount(0)

  await page.getByRole('link', { name: /费用类别构成/ }).click()
  await expect(page).toHaveURL(/\/analysis\/categories\?/)
  await expect(page.getByRole('button', { name: '返回数据分析' })).toBeVisible()
  await page.getByRole('link', { name: '停车，¥20.00，1笔，100%' }).click()
  await page.getByRole('button', { name: /^筛选(?:，已生效 \d+ 项)?$/ }).click()
  const filters = page.getByRole('dialog', { name: '筛选与排序' })
  await expect(filters.getByLabel('开始日期')).toHaveValue('2026-01-01')
  await expect(filters.getByLabel('结束日期')).toHaveValue('2026-01-31')
  await expect(filters.getByLabel('类别筛选')).toHaveValue('parking')
  await filters.getByRole('button', { name: '关闭' }).click()
  await page.getByRole('button', { name: '查看2026年1月10日停车记录' }).click()
  await page.getByRole('dialog', { name: '记录详情' }).getByRole('button', { name: '编辑记录' }).click()
  await page.getByLabel('金额（元）').fill('25')
  await page.getByRole('button', { name: '保存更改' }).click()
  await page.goBack()
  await page.getByRole('button', { name: '返回数据分析' }).click()

  await expect(page.getByLabel('时间范围')).toHaveValue('custom')
  await expect(page.getByLabel('分析开始日期')).toHaveValue('2026-01-01')
  await expect(page.getByLabel('分析结束日期')).toHaveValue('2026-01-31')
  await expect(page.getByLabel('分析类别')).toHaveValue('parking')
  await expect(page.locator('.metric').filter({ hasText: '总费用' })).toContainText('¥25.00')

  await page.getByRole('link', { name: /费用类别构成/ }).click()
  await page.getByRole('link', { name: '停车，¥25.00，1笔，100%' }).focus()
  await page.keyboard.press('Enter')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '查看2026年1月10日停车记录' }).click()
  await page.getByRole('dialog', { name: '记录详情' }).getByRole('button', { name: '删除记录' }).click()
  await page.goBack()
  await page.getByRole('button', { name: '返回数据分析' }).click()
  await expect(page.locator('.metric').filter({ hasText: '总费用' })).toContainText('¥0.00')
})

test('moves the twelve-month vehicle energy summary from home into analysis and preserves filters on return', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('V1.17 能耗分析车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()

  for (const entry of [
    { date: '2026-07-01T10:00', mileage: '1000', amount: '200', liters: '40' },
    { date: '2026-08-01T10:00', mileage: '1500', amount: '160', liters: '40' },
  ]) {
    await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
    await page.getByRole('button', { name: '加油', exact: true }).click()
    await page.getByLabel('金额（元）').fill(entry.amount)
    await page.getByLabel('发生时间').fill(entry.date)
    await page.getByLabel('当前里程（km）').fill(entry.mileage)
    await page.getByLabel('加油量（升）').fill(entry.liters)
    await page.getByLabel('已加满').check()
    await page.getByRole('button', { name: '保存并查看记录' }).click()
  }

  await page.goto('/')
  await expect(page.getByRole('heading', { name: '车辆与能耗摘要' })).toHaveCount(0)
  await expect(page.locator('.metric').filter({ hasText: '当前里程' })).toContainText('1500 km')

  await page.goto('/analysis?range=custom&start=2026-01-01&end=2026-01-31&category=parking')
  const energyCard = page.getByRole('link', { name: /能耗分析/ })
  await expect(page.locator('.analysis-entry-card')).toHaveCount(4)
  await expect(energyCard).toContainText('近12个月 · 平均油耗 8.00 L/100km · ¥0.32/km')
  await energyCard.click()
  await expect(page).toHaveURL(/\/energy\?vehicle=/)
  await expect(page.getByLabel('能耗车辆').locator('option:checked')).toHaveText('V1.17 能耗分析车')
  await expect(page.getByLabel('能耗时间范围')).toHaveValue('twelve')
  await expect(page.locator('.metric').filter({ hasText: '平均油耗' })).toContainText('8.00 L/100km')
  await page.getByRole('button', { name: '返回数据分析' }).click()
  await expect(page.getByLabel('时间范围')).toHaveValue('custom')
  await expect(page.getByLabel('分析开始日期')).toHaveValue('2026-01-01')
  await expect(page.getByLabel('分析结束日期')).toHaveValue('2026-01-31')
  await expect(page.getByLabel('分析类别')).toHaveValue('parking')
})

test('summarizes an all-vehicle energy empty state and opens vehicle selection', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('暂无能耗车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()
  const vehicleSelector = page.locator('main > header').getByLabel('当前车辆')
  await vehicleSelector.selectOption('all')
  await expect(vehicleSelector).toHaveValue('all')
  await page.getByRole('link', { name: '数据分析', exact: true }).click()

  const energyCard = page.getByRole('link', { name: /能耗分析/ })
  await expect(energyCard).toContainText('近12个月 · 暂无可计算的能耗数据')
  await energyCard.click()
  await expect(page).toHaveURL(/\/energy$/)
  await expect(page.getByRole('heading', { name: '能耗统计' })).toBeVisible()
  await expect(page.getByText('请选择一辆具体车辆查看能耗统计。')).toBeVisible()
  await expect(page.getByLabel('选择能耗车辆')).toBeVisible()
  await expect(page.getByRole('button', { name: '返回数据分析' })).toBeVisible()
})

for (const deviceName of ['iPhone 14', 'Galaxy S9+']) {
  const { defaultBrowserType: _defaultBrowserType, ...device } = devices[deviceName]

  test.describe(`mobile analysis acceptance: ${deviceName}`, () => {
    test.use(device)

    test('keeps filters, entry cards and trend detail usable in portrait and landscape', async ({ page }) => {
      await page.goto('/vehicles')
      await page.getByRole('button', { name: '新增车辆' }).click()
      await page.getByLabel('车辆名称').fill(`${deviceName} 分析车`)
      await page.getByLabel('初始里程（km）').fill('0')
      await page.getByRole('button', { name: '保存车辆' }).click()
      await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
      await page.getByLabel('金额（元）').fill('18')
      await page.getByLabel('发生时间').fill('2026-01-10T10:00')
      await page.getByRole('button', { name: '保存并查看记录' }).click()
      await page.goto('/analysis?range=custom&start=2026-01-01&end=2026-01-31')

      const cards = page.locator('.analysis-entry-card')
      await expect(cards).toHaveCount(4)
      const [firstCard, secondCard] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()])
      expect(firstCard).not.toBeNull()
      expect(secondCard).not.toBeNull()
      expect(firstCard!.y + firstCard!.height).toBeLessThanOrEqual(secondCard!.y)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

      await cards.nth(0).focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/analysis\/trend\?/)
      await expect(page.getByRole('img', { name: '费用趋势图' })).toBeVisible()
      const drillDown = page.locator('.analysis-points a').first()
      expect((await drillDown.boundingBox())!.height).toBeGreaterThanOrEqual(40)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      await page.setViewportSize({ width: 844, height: 390 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
    test('opens complete trend, month and category detail pages without overflow', async ({ page }) => {
      await page.goto('/vehicles')
      await page.getByRole('button', { name: '新增车辆' }).click()
      await page.getByLabel('车辆名称').fill(`${deviceName} 子页分析车`)
      await page.getByLabel('初始里程（km）').fill('0')
      await page.getByRole('button', { name: '保存车辆' }).click()

      const entries = [
        { category: '停车', amount: '10', occurredAt: '2026-01-10T10:00' }, { category: '洗车', amount: '20', occurredAt: '2026-02-10T10:00' }, { category: '保养', amount: '30', occurredAt: '2026-03-10T10:00' }, { category: '维修', amount: '40', occurredAt: '2026-04-10T10:00' },
      ]
      for (const entry of entries) {
        await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
        if (entry.category !== '停车') await page.getByRole('button', { name: entry.category, exact: true }).click()
        await page.getByLabel('金额（元）').fill(entry.amount)
        await page.getByLabel('发生时间').fill(entry.occurredAt)
        await page.getByRole('button', { name: '保存并查看记录' }).click()
      }

      await page.goto('/analysis?range=custom&start=2026-01-01&end=2026-04-30')
      await page.getByRole('link', { name: /费用趋势/ }).click()
      await expect(page.locator('.analysis-points a')).toHaveCount(4)
      await page.goBack()
      await page.getByRole('link', { name: /月份费用对比/ }).click()
      await expect(page.locator('.analysis-months a')).toHaveCount(4)
      await page.goBack()
      await page.getByRole('link', { name: /费用类别构成/ }).click()
      await expect(page.locator('.analysis-breakdown a')).toHaveCount(4)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
  })
}
