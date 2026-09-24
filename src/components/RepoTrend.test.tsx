import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RepoTrend } from './RepoTrend'

const history = [
  { at: '2026-09-01T00:00:00Z', repos: { 'a/app': 100 }, forks: { 'a/app': 8 } },
  { at: '2026-09-20T00:00:00Z', repos: { 'a/app': 90 }, forks: { 'a/app': 9 } },
]
describe('RepoTrend', () => {
  it('提供可读原始数据并切换 Fork；下降保持负数', async () => {
    render(<RepoTrend repo="a/app" history={history} window="30d" />)
    expect(screen.getByRole('img', { name: /星标趋势/ })).toBeInTheDocument()
    expect(screen.getByTestId('trend-change')).toHaveTextContent('-10')
    await userEvent.click(screen.getByRole('button', { name: 'Fork' }))
    expect(screen.getByRole('img', { name: /Fork 趋势/ })).toBeInTheDocument()
    expect(screen.getByTestId('trend-change')).toHaveTextContent('+1')
    expect(screen.getByText('原始采集记录')).toBeInTheDocument()
  })
  it('只有一个真实点时不给历史增长或伪造曲线', () => {
    render(<RepoTrend repo="a/app" history={[history[1]]} window="30d" />)
    expect(screen.getByText(/历史不足/)).toBeInTheDocument()
    expect(screen.queryByTestId('trend-change')).not.toBeInTheDocument()
  })
})
