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
  await expect(page.locator('.records-mobile-groups')).toBeHidden()
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
test('switches between the grouped mobile cards and desktop table at the 767px boundary', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 900 })
  await createRecord(page, '断点验收车')

  await expect(page.locator('.mobile-nav')).toBeVisible()
  await expect(page.locator('.records-mobile-groups')).toBeVisible()
  await expect(page.locator('.records-table')).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.setViewportSize({ width: 768, height: 900 })
  await expect(page.locator('.records-mobile-groups')).toBeHidden()
  await expect(page.locator('.records-table')).toBeVisible()
})
for (const deviceName of ['iPhone 14', 'Galaxy S9+']) {
  const { defaultBrowserType: _defaultBrowserType, ...device } = devices[deviceName]

  test.describe('mobile detailed-record acceptance: ' + deviceName, () => {
    test.use(device)

    test('shows readable compact rows without inline actions and no horizontal overflow', async ({ page }) => {
      await createRecord(page, deviceName + ' 详细记录车')

      await expect(page.locator('.records-mobile-groups')).toBeVisible()
      await expect(page.locator('.records-table')).toBeHidden()
      const row = page.locator('.record-mobile-card').first()
      await expect(row).toContainText('停车')
      await expect(row).not.toContainText('测试停车场')
      await expect(row.locator('.record-mobile-datetime')).toHaveText('08:00')
      await expect(page.getByRole('heading', { name: '2026年9月4日' })).toBeVisible()
      await expect(page.getByLabel('2026年9月4日合计¥12.00')).toHaveText('¥12.00')
      await expect(row.getByRole('button', { name: /编辑|删除|复制/ })).toHaveCount(0)
      await expect(row.locator('.record-mobile-icon svg')).toHaveAttribute('aria-hidden', 'true')
      await expect(row.locator('.record-card-chevron')).toHaveCount(0)
      const view = row.getByRole('button', { name: /查看2026年9月4日 08:00 停车 ¥12\.00/ })
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

test('keeps long mobile record content readable from 320px through 430px', async ({ page }) => {
  await createVehicle(page, '一辆名称非常长但仍然需要安全显示的家庭用车')
  await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
  await page.getByLabel('金额（元）').fill('1234567.89')
  await page.getByLabel('发生时间').fill('2026-09-04T08:05')
  await page.getByLabel('停车场或地点').fill('名称非常长的国际机场地下停车场东区入口附近')
  await page.getByRole('button', { name: '保存并查看记录' }).click()

  for (const width of [320, 375, 390, 414, 430]) {
    await page.setViewportSize({ width, height: 900 })
    const groups = page.locator('.records-mobile-groups')
    const row = page.locator('.record-mobile-card').first()
    await expect(groups).toBeVisible()
    await expect(row.locator('.record-mobile-amount')).toHaveText('¥1234567.89')
    await expect(row.locator('.record-mobile-datetime')).toHaveText('08:05')
    const boxes = await row.evaluate(element => {
      const main = element.querySelector('.record-mobile-main')!.getBoundingClientRect()
      const side = element.querySelector('.record-mobile-side')!.getBoundingClientRect()
      return { mainRight: main.right, sideLeft: side.left, rowWidth: element.getBoundingClientRect().width }
    })
    expect(boxes.mainRight).toBeLessThanOrEqual(boxes.sideLeft)
    expect(boxes.rowWidth).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
})

test('preserves mobile detail focus and updates the current result after edit and delete', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await createRecord(page, '交互闭环验收车')
  const row = page.locator('.record-mobile-view').first()

  await row.focus()
  await row.press('Enter')
  let detail = page.getByRole('dialog', { name: '记录详情' })
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: '关闭' }).click()
  await expect(row).toBeFocused()

  await row.press('Space')
  detail = page.getByRole('dialog', { name: '记录详情' })
  await detail.getByRole('button', { name: '编辑记录' }).click()
  const edit = page.getByRole('dialog', { name: '编辑记录' })
  await edit.getByLabel('金额（元）').fill('15')
  await edit.getByRole('button', { name: '保存更改' }).click()
  await expect(page.getByText('记录已更新。', { exact: true })).toBeVisible()
  await expect(page.locator('.record-mobile-amount')).toHaveText('¥15.00')
  await expect(page.getByLabel('记录结果概览')).toContainText('1 笔 · ¥15.00')

  const updatedRow = page.locator('.record-mobile-view').first()
  await updatedRow.click()
  detail = page.getByRole('dialog', { name: '记录详情' })
  page.once('dialog', dialog => dialog.accept())
  await detail.getByRole('button', { name: '删除记录' }).click()
  await expect(page.getByLabel('记录结果概览')).toContainText('0 笔 · ¥0.00')
  await expect(page.getByRole('heading', { name: '详细记录' })).toBeFocused()
})

test('keeps grouped cards usable in a narrow mobile landscape viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await createRecord(page, '横屏验收车')
  await page.setViewportSize({ width: 740, height: 390 })

  await expect(page.locator('.records-mobile-groups')).toBeVisible()
  await expect(page.locator('.records-table')).toBeHidden()
  await expect(page.locator('.record-mobile-view').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('uses separate date groups and independent cards while remaining readable with enlarged mobile text', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 })
  await createRecord(page, '分隔线验收车')
  await page.locator('main > header').getByRole('button', { name: '记一笔', exact: true }).click()
  await page.getByLabel('金额（元）').fill('5')
  await page.getByLabel('发生时间').fill('2026-09-03T07:30')
  await page.getByLabel('停车场或地点').fill('第二停车场')
  await page.getByRole('button', { name: '保存并查看记录' }).click()

  const groups = page.locator('.record-date-group')
  const rows = page.locator('.record-mobile-card')
  await expect(groups).toHaveCount(2)
  await expect(rows).toHaveCount(2)
  await expect(page.getByRole('heading', { name: '2026年9月4日' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '2026年9月3日' })).toBeVisible()
  const cardVisual = await rows.first().locator('.record-mobile-view').evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, radius: Number.parseFloat(style.borderRadius), shadow: style.boxShadow }
  })
  expect(cardVisual.background).toBe('rgb(255, 255, 255)')
  expect(cardVisual.radius).toBeGreaterThanOrEqual(16)
  expect(cardVisual.shadow).not.toBe('none')

  await page.addStyleTag({ content: '.record-mobile-category,.record-mobile-amount,.record-mobile-meta,.record-mobile-datetime{font-size:200%!important}' })
  const firstRow = rows.first()
  const boxes = await firstRow.evaluate(element => {
    const main = element.querySelector('.record-mobile-main')!.getBoundingClientRect()
    const side = element.querySelector('.record-mobile-side')!.getBoundingClientRect()
    return { mainRight: main.right, sideLeft: side.left }
  })
  expect(boxes.mainRight).toBeLessThanOrEqual(boxes.sideLeft)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
