import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { StarsPage } from './StarsPage'
import type { Project } from '../data/types'
import type { StarSnapshot } from '../data/starTypes'

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

function ghProject(fullName: string, stars: number, title: string, ageDays: number): Project {
  return {
    id: `gh-${fullName}`,
    slug: fullName.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    title,
    tagline: '仓库自述（原文）：something',
    story: '仓库自述（原文）：something',
    category: 'ai',
    tags: [],
    stack: ['TypeScript'],
    maker: { name: fullName.split('/')[0], handle: fullName.split('/')[0] },
    links: [{ kind: 'repo', label: '查看源码', url: `https://github.com/${fullName}` }],
    createdAt: daysAgo(ageDays),
    likes: 0,
    stars,
    featured: false,
    status: 'live',
    provenance: { source: 'github', repoFullName: fullName, htmlUrl: `https://github.com/${fullName}` },
  }
}

const projects = [
  ghProject('a/skills', 300, 'Skills', 100),
  ghProject('b/app', 500, 'App', 10),
  ghProject('c/lib', 200, 'Lib', 200),
]
const twoSnapshots: StarSnapshot[] = [
  { at: daysAgo(20), repos: { 'a/skills': 200, 'b/app': 480, 'c/lib': 190 } },
  { at: daysAgo(1), repos: { 'a/skills': 300, 'b/app': 500, 'c/lib': 200 } },
]
const oneSnapshot: StarSnapshot[] = [{ at: daysAgo(1), repos: { 'a/skills': 300, 'b/app': 500, 'c/lib': 200 } }]

function renderPage(history: StarSnapshot[]) {
  render(
    <MemoryRouter>
      <StarsPage projects={projects} history={history} />
    </MemoryRouter>,
  )
}

describe('StarsPage', () => {
  it('有两次快照时按增量排榜并显示增量列', () => {
    renderPage(twoSnapshots)
    const rows = screen.getAllByTestId(/^star-row-/)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('a/skills')).toBeInTheDocument()
    expect(within(rows[0]).getByText('+100')).toBeInTheDocument()
  })

  it('只有一次快照时把增量榜禁用并说清原因', async () => {
    renderPage(oneSnapshot)
    const gainTab = screen.getByRole('button', { name: /增量榜/ })
    expect(gainTab).toBeDisabled()
    expect(screen.getByText(/需要至少两次快照/)).toBeInTheDocument()
    expect(screen.queryByText(/^\+100$/)).not.toBeInTheDocument()
  })

  it('可以切换到日均增速榜与存量榜', async () => {
    const user = userEvent.setup()
    renderPage(oneSnapshot)

    await user.click(screen.getByRole('button', { name: /增速榜/ }))
    let rows = screen.getAllByTestId(/^star-row-/)
    expect(within(rows[0]).getByText('b/app')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /存量榜/ }))
    rows = screen.getAllByTestId(/^star-row-/)
    expect(within(rows[0]).getByText('b/app')).toBeInTheDocument()
    expect(within(rows[0]).getByText('500')).toBeInTheDocument()
  })

  it('按分类筛选可以只留技能包', async () => {
    const user = userEvent.setup()
    renderPage(twoSnapshots)
    await user.click(screen.getByRole('button', { name: /技能包/ }))
    const rows = screen.getAllByTestId(/^star-row-/)
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('a/skills')).toBeInTheDocument()
  })

  it('时间窗口可以切换成日 / 周 / 月', async () => {
    const user = userEvent.setup()
    renderPage(twoSnapshots)
    await user.click(screen.getByRole('button', { name: '日' }))
    expect(screen.getByText(/窗口内快照不足两次/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '月' }))
    expect(screen.getAllByTestId(/^star-row-/)).toHaveLength(3)
  })
})
