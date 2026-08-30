import { expect, test } from '@playwright/test'

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
  await page.getByRole('button', { name: '保存记录' }).click()
  await expect(page.getByText('共 1 笔，合计 ¥20.00')).toBeVisible()
})
