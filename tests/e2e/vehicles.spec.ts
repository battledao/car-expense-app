import { expect, test } from '@playwright/test'

async function addVehicle(page: import('@playwright/test').Page, name: string, plate: string) {
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill(name)
  await page.getByLabel('初始里程（km）').fill('1000')
  await page.getByLabel('车牌号').fill(plate)
  await page.getByRole('button', { name: '保存车辆' }).click()
}

test('manages vehicle cards, default vehicle, and basic edits', async ({ page }) => {
  await page.goto('/vehicles')
  await addVehicle(page, '城市通勤车', '京A10001')
  await addVehicle(page, '周末出行车', '京A20002')

  const weekendCard = page.locator('.vehicle-list .panel').filter({ has: page.getByRole('heading', { name: '周末出行车' }) })
  await expect(weekendCard.getByText('车牌号：京A20002')).toBeVisible()
  await expect(weekendCard.getByText('当前里程')).toContainText('1000 km')
  await weekendCard.getByText('更多操作').click()
  await weekendCard.getByRole('button', { name: '设为默认' }).click()
  await expect(weekendCard.getByText('默认车辆')).toBeVisible()

  await weekendCard.getByRole('button', { name: '编辑车辆' }).click()
  const dialog = page.getByRole('dialog', { name: '编辑车辆' })
  await dialog.getByLabel('车辆名称').fill('更新后的周末出行车')
  await dialog.getByRole('button', { name: '保存车辆' }).click()
  await expect(page.getByRole('heading', { name: '更新后的周末出行车' })).toBeVisible()
})

test('keeps vehicle cards and primary actions inside an iPhone 14-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/vehicles')
    await addVehicle(page, '手机验收车辆', '沪B30003')
    const card = page.locator('.vehicle-list .panel').filter({ has: page.getByRole('heading', { name: '手机验收车辆' }) })
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: '记一笔', exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: '查看记录' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
})
