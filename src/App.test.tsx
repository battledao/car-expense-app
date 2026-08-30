import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import App from './App'

it('shows all seven primary navigation items', () => {
  render(<MemoryRouter><App /></MemoryRouter>)
  for (const label of ['首页总览', '用车记账', '费用日历', '数据分析', '详细记录', '能耗统计', '车辆管理']) expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '＋记一笔' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '数据管理' })).toBeInTheDocument()
  expect(screen.getAllByText(/⌂|✎|□|◔|☷|ϟ|▣/)).toHaveLength(7)
})
