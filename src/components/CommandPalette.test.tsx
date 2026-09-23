import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './CommandPalette'
import { seedProjects } from '../data/seed'
import { buildPaletteItems, PALETTE_PAGES } from '../lib/paletteItems'

const items = buildPaletteItems({
  projects: seedProjects,
  wishes: [
    {
      id: 'w1',
      slug: 'tide-wish',
      title: '想要一个潮汐提醒的看板',
      brief: '每天看一眼涨潮时间。',
      category: 'life',
      tags: [],
      wisher: { name: '小满', handle: 'xiaoman' },
      createdAt: '2026-09-10',
      status: 'open',
      cheers: 2,
      provenance: { source: 'seed' },
    },
  ],
  posts: [],
})

function renderPalette(overrides: { onClose?: () => void; onSelect?: (id: string) => void } = {}) {
  return render(
    <CommandPalette open items={items} onClose={overrides.onClose ?? (() => {})} onSelect={overrides.onSelect ?? (() => {})} />,
  )
}

describe('CommandPalette', () => {
  it('surfaces every work when the query is empty', () => {
    renderPalette()
    expect(screen.getAllByRole('option').length).toBe(items.length)
    expect(screen.getAllByRole('option').length).toBeGreaterThan(seedProjects.length)
  })

  it('filters by title, maker and stack while typing', async () => {
    const user = userEvent.setup()
    renderPalette()
    const input = screen.getByLabelText('搜索页面、作品、愿望或帖子')
    await user.type(input, '潮汐')
    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('潮汐时钟')]),
    )
  })

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByLabelText('搜索页面、作品、愿望或帖子'), 'zzzz-不存在')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/没有找到/)).toBeInTheDocument()
  })

  it('opens the highlighted work on Enter and moves the highlight with arrow keys', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderPalette({ onSelect })
    await user.type(screen.getByLabelText('搜索页面、作品、愿望或帖子'), '看板')
    const options = screen.getAllByRole('option')
    expect(options[0].textContent).toContain('霓虹看板')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toBe(options[1].getAttribute('data-item'))
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPalette({ onClose })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('能搜到页面入口', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByLabelText('搜索页面、作品、愿望或帖子'), '论坛')
    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent).join(' ')).toContain('论坛')
    expect(PALETTE_PAGES.some((page) => page.path === '/forum')).toBe(true)
  })
})

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        打开面板
      </button>
      <button type="button">面板外的按钮</button>
      <CommandPalette open={open} items={items} onClose={() => setOpen(false)} onSelect={() => {}} />
    </>
  )
}

describe('CommandPalette 焦点管理', () => {
  it('keeps Tab focus inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: '打开面板' }))
    const dialog = screen.getByRole('dialog', { name: '快速跳转' })

    for (let index = 0; index < 30; index += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('returns focus to the trigger after closing', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: '打开面板' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(trigger)
  })
})
