import { expect, test } from '@playwright/test'

test('V1.9 mobile shell keeps the primary action and bottom navigation usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const header = page.locator('.global-header')
  const bottomNavigation = page.getByLabel('手机主导航')

  await expect(header).toBeVisible()
  await expect(page.getByRole('button', { name: '记一笔' })).toBeVisible()
  await expect(bottomNavigation).toBeVisible()
  await expect(bottomNavigation.getByRole('link', { name: '首页' })).toHaveClass(/active/)
  const horizontalOverflow = await page.locator('body').evaluate((body) => body.scrollWidth - body.clientWidth)
  expect(horizontalOverflow).toBeLessThanOrEqual(1)
})

test('V1.9 desktop shell exposes one visible primary navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')

  await expect(page.getByRole('navigation', { name: '主导航', exact: true })).toBeVisible()
  await expect(page.getByLabel('手机主导航')).toBeHidden()
  await expect(page.getByRole('link', { name: '首页总览' })).toHaveClass(/active/)
})
