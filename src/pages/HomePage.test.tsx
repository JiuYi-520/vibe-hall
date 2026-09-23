import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage'
import { seedProjects } from '../data/seed'

function renderHome(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<HomePage projects={seedProjects} />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('shows every work in the hall by default', () => {
    renderHome()
    expect(screen.getByTestId('result-count')).toHaveTextContent(new RegExp(`^${seedProjects.length}$`))
    expect(screen.getAllByRole('link', { name: /霓虹看板/ }).length).toBeGreaterThan(0)
  })

  it('narrows the grid when a category chip is clicked', async () => {
    const user = userEvent.setup()
    renderHome()
    await user.click(screen.getByRole('button', { name: /游戏/ }))
    expect(screen.getByTestId('result-count')).toHaveTextContent(/^1$/)
    expect(screen.getAllByRole('link', { name: /像素小农场/ }).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('link', { name: /霓虹看板/ })).toHaveLength(0)
  })

  it('narrows the grid while typing in the search box', async () => {
    const user = userEvent.setup()
    renderHome()
    await user.type(screen.getByRole('searchbox', { name: /搜索/ }), '潮汐')
    expect(screen.getByTestId('result-count')).toHaveTextContent(/^1$/)
  })

  it('restores filters from a shared url', () => {
    renderHome('/?cats=game')
    expect(screen.getByTestId('result-count')).toHaveTextContent(/^1$/)
  })

  it('clears every filter when nothing matches and the reset button is used', async () => {
    const user = userEvent.setup()
    renderHome('/?q=zzzz-不存在')
    const empty = screen.getByTestId('empty-state')
    await user.click(within(empty).getByRole('button', { name: /清空/ }))
    expect(screen.getByTestId('result-count')).toHaveTextContent(new RegExp(`^${seedProjects.length}$`))
  })
})
