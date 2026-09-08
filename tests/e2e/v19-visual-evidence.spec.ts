import { expect, test } from '@playwright/test'

const pages = [
  ['/', '首页总览', 'home'],
  ['/record', '用车记账', 'record'],
  ['/analysis', '数据分析', 'analysis'],
  ['/vehicles', '车辆管理', 'vehicles'],
] as const

test('V1.9 captures the four approved visual pages at mobile and desktop widths', async ({ page }) => {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill('视觉验收车')
  await page.getByLabel('初始里程（km）').fill('0')
  await page.getByRole('button', { name: '保存车辆' }).click()

  await page.goto('/record')
  await page.getByRole('button', { name: '停车' }).click()
  await page.getByLabel('金额（元）').fill('28.5')
  await page.getByLabel('当前里程（km）').fill('1280')
  await page.getByRole('button', { name: '保存并查看记录' }).click()

  for (const [path, heading, name] of pages) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await page.screenshot({ path: `test-results/v19-${name}-390.png`, fullPage: true })

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await page.screenshot({ path: `test-results/v19-${name}-1280.png`, fullPage: true })
  }
})
