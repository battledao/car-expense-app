import { expect, test } from '@playwright/test'

async function addVehicle(page: import('@playwright/test').Page, name: string) {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: '新增车辆' }).click()
  await page.getByLabel('车辆名称').fill(name)
  await page.getByLabel('初始里程（km）').fill('1000')
  await page.getByRole('button', { name: '保存车辆' }).click()
}

test('V1.10 mobile more hub exposes three clear cards without global controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/more')

  await expect(page.getByRole('heading', { name: '更多' })).toBeVisible()
  await expect(page.getByText('车辆与用车')).toBeVisible()
  await expect(page.getByText('数据与安全')).toBeVisible()
  await expect(page.getByRole('link', { name: /车辆管理.*还没有车辆/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /能耗统计.*添加车辆后可使用/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /数据管理.*仅保存在本机/ })).toBeVisible()
  expect(await page.locator('.more-card').evaluateAll(cards => cards.every(card => getComputedStyle(card).textDecorationLine === 'none'))).toBe(true)
  await expect(page.locator('.global-header')).toBeHidden()
  await expect(page.getByLabel('手机主导航').getByRole('link', { name: '更多' })).toHaveAttribute('aria-current', 'page')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})

test('V1.10 more hub reflects vehicle state and preserves the navigation return path', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await addVehicle(page, '城市通勤车')
  await page.goto('/more')

  await expect(page.getByRole('link', { name: /车辆管理.*共 1 辆.*默认：城市通勤车/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /能耗统计.*查看城市通勤车的油耗数据/ })).toBeVisible()

  await page.getByRole('link', { name: /车辆管理.*共 1 辆.*默认：城市通勤车/ }).click()
  await expect(page).toHaveURL(/\/vehicles$/)
  await expect(page.locator('.global-header > .more-return')).toBeVisible()
  await expect(page.locator('section.vehicles-page > .more-return')).toHaveCount(0)
  const returnBox = await page.locator('.global-header > .more-return').boundingBox()
  const vehicleSelectBox = await page.locator('.global-header select').boundingBox()
  expect(Math.abs((returnBox?.y ?? 0) - (vehicleSelectBox?.y ?? 0))).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: '返回更多' })).toBeVisible()
  await expect(page.getByLabel('手机主导航').getByRole('link', { name: '更多' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: '返回更多' }).click()
  await expect(page).toHaveURL(/\/more$/)

  await page.getByRole('link', { name: /能耗统计.*查看城市通勤车的油耗数据/ }).click()
  await expect(page).toHaveURL(/\/energy$/)
  await expect(page.locator('.global-header > .more-return')).toBeVisible()
  await expect(page.locator('section.energy-page > .more-return')).toHaveCount(0)
  await page.getByRole('button', { name: '返回更多' }).click()
  await expect(page).toHaveURL(/\/more$/)

  await page.getByRole('link', { name: /数据管理/ }).click()
  await expect(page).toHaveURL(/\/vehicles\?data=1$/)
  await expect(page.getByRole('heading', { name: '数据管理' })).toBeVisible()
  await expect(page.locator('.global-header > .more-return')).toBeVisible()
  await expect(page.locator('section.vehicles-page > .more-return')).toHaveCount(0)
  await page.getByRole('button', { name: '返回更多' }).click()
  await expect(page).toHaveURL(/\/more$/)

  await page.goto('/vehicles')
  await expect(page.locator('.global-header > .more-return')).toHaveCount(0)
  await expect(page.locator('section.vehicles-page > .more-return')).toHaveCount(0)
})

test('V1.10 more hub stays readable without horizontal overflow across supported widths', async ({ page }) => {
  for (const width of [320, 375, 390, 414, 430, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/more')
    await expect(page.locator('.more-card')).toHaveCount(3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    if (width < 768) await expect(page.locator('.global-header')).toBeHidden()
    else await expect(page.locator('.global-header')).toBeVisible()
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/more')
  const cards = page.locator('.more-card')
  const firstCard = await cards.nth(0).boundingBox()
  const secondCard = await cards.nth(1).boundingBox()
  expect(firstCard?.y).toBeGreaterThan(0)
  expect((secondCard?.y ?? 844) + (secondCard?.height ?? 0)).toBeLessThan(764)
})
