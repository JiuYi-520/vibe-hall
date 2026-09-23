import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './CommandPalette'
import { seedProjects } from '../data/seed'

describe('CommandPalette', () => {
  it('surfaces every work when the query is empty', () => {
    render(<CommandPalette open projects={seedProjects} onClose={() => {}} onSelect={() => {}} />)
    expect(screen.getAllByRole('option').length).toBe(seedProjects.length)
  })

  it('filters by title, maker and stack while typing', async () => {
    const user = userEvent.setup()
    render(<CommandPalette open projects={seedProjects} onClose={() => {}} onSelect={() => {}} />)
    const input = screen.getByLabelText('搜索作品、作者或技术栈')
    await user.type(input, '潮汐')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('潮汐时钟')
  })

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup()
    render(<CommandPalette open projects={seedProjects} onClose={() => {}} onSelect={() => {}} />)
    await user.type(screen.getByLabelText('搜索作品、作者或技术栈'), 'zzzz-不存在')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/没有找到/)).toBeInTheDocument()
  })

  it('opens the highlighted work on Enter and moves the highlight with arrow keys', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CommandPalette open projects={seedProjects} onClose={() => {}} onSelect={onSelect} />)
    await user.type(screen.getByLabelText('搜索作品、作者或技术栈'), '看板')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toBe('sleep-dashboard')
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CommandPalette open projects={seedProjects} onClose={onClose} onSelect={() => {}} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
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
      <CommandPalette open={open} projects={seedProjects} onClose={() => setOpen(false)} onSelect={() => {}} />
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
