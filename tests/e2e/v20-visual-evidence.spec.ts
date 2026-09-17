import { expect, test } from '@playwright/test'

const pages = [
  ['/', '首页总览', 'home'],
  ['/record', '用车记账', 'record'],
  ['/analysis', '数据分析', 'analysis'],
  ['/records', '详细记录', 'records'],
  ['/vehicles', '车辆管理', 'vehicles'],
] as const

test('V1.20 captures the approved visual pages at mobile and desktop widths', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(`${message.text()} ${message.location().url}`.trim()) })
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('视觉验收车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()

  await page.goto('/record')
  await page.getByRole('button', { name: '停车' }).click()
  await page.getByLabel('金额（元）').fill('28.5')
  await page.getByLabel('发生时间').fill('2026-09-10T22:21')
  await page.getByLabel('当前里程（km）').fill('1280')
  await page.getByLabel('停车场或地点').fill('城市中心停车场')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await expect(page).toHaveURL(/\/records/)
  await expect(page.getByLabel('记录结果概览')).toContainText('1 笔 · ¥28.50')

  await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
  await page.getByRole('button', { name: '洗车' }).click()
  await page.getByLabel('金额（元）').fill('12')
  await page.getByLabel('发生时间').fill('2026-09-11T09:15')
  await page.getByLabel('商家或地点').fill('社区洗车中心')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await expect(page.getByLabel('记录结果概览')).toContainText('2 笔 · ¥40.50')

  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
  await page.getByRole('button', { name: '保养' }).click()
  await page.getByLabel('金额（元）').fill('99')
  await page.getByLabel('发生时间').fill(`${today}T14:12`)
  await page.getByLabel('门店或维修厂').fill('仅在详情展示的门店')
  await page.getByRole('button', { name: '保存并查看记录' }).click()
  await expect(page.getByLabel('记录结果概览')).toContainText('3 笔 · ¥139.50')

  for (const [path, heading, name] of pages) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    if (path === '/records') {
      const groups = page.getByLabel('手机详细记录分组')
      await expect(groups).toBeVisible()
      await expect(groups.getByRole('heading', { name: '今天' })).toBeVisible()
      await expect(groups.getByRole('heading', { name: '2026年9月11日' })).toBeVisible()
      await expect(groups.getByText('仅在详情展示的门店')).toHaveCount(0)
      await expect(groups.locator('.record-mobile-card')).toHaveCount(3)
    }
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    await page.screenshot({ path: `test-results/v20-${name}-390.png`, fullPage: true })

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    await page.screenshot({ path: `test-results/v20-${name}-1280.png`, fullPage: true })
  }

  expect(consoleErrors).toEqual([])
})
