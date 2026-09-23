import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SiteSidebar } from './SiteSidebar'
import { createUiPrefs } from '../lib/uiPrefs'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

function renderSidebar({ path = '/', open = true, narrow = false } = {}) {
  const prefs = createUiPrefs({ storage: memoryStorage(), width: 1440 })
  prefs.setOpen(open)
  const onToggle = () => prefs.toggle()
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={<SiteSidebar open={prefs.getOpen()} narrow={narrow} onClose={onToggle} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  return { prefs }
}

describe('SiteSidebar', () => {
  it('列出全部站点入口', () => {
    renderSidebar()
    const nav = screen.getByRole('navigation', { name: '主导航' })
    // 用无障碍名而不是 textContent：装饰性字符是 aria-hidden 的，不该算进名字里
    for (const label of ['展馆', '升星榜', '愿望墙', '论坛', '提交作品', '关于']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(nav).getAllByRole('link')).toHaveLength(6)
  })

  it('当前页面在侧边栏里被标为当前位置', () => {
    renderSidebar({ path: '/forum' })
    expect(screen.getByRole('link', { name: '论坛' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '愿望墙' })).not.toHaveAttribute('aria-current')
  })

  it('收起时整块不可聚焦（inert），展开时恢复正常', () => {
    const { unmount } = render(
      <MemoryRouter>
        <SiteSidebar open={false} narrow={false} onClose={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('站点侧边栏')).toHaveAttribute('inert')
    unmount()

    render(
      <MemoryRouter>
        <SiteSidebar open narrow={false} onClose={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('站点侧边栏')).not.toHaveAttribute('inert')
  })

  it('可以点收起按钮隐藏侧边栏', async () => {
    const user = userEvent.setup()
    const { prefs } = renderSidebar()
    await user.click(screen.getByRole('button', { name: '隐藏侧边栏' }))
    expect(prefs.getOpen()).toBe(false)
  })

  it('窄屏抽屉打开时按 Esc 会关闭', async () => {
    const user = userEvent.setup()
    const { prefs } = renderSidebar({ narrow: true, open: true })
    await user.keyboard('{Escape}')
    expect(prefs.getOpen()).toBe(false)
  })

  it('显示本机身份（有身份时）', () => {
    renderSidebar()
    expect(screen.getByText(/本机身份/)).toBeInTheDocument()
  })
})
