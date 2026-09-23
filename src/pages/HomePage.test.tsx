import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import { seedProjects } from '../data/seed'
import type { Project } from '../data/types'

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

describe('HomePage 文案', () => {
  it('给出全中文的排序选项', () => {
    renderHome()
    const group = screen.getByRole('group', { name: '排序方式' })
    const labels = within(group)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim() ?? '')
    expect(labels).toEqual(['热度', '最新', '最早', '星标', '名称'])
    expect(labels.filter((label) => /[A-Za-z]/.test(label))).toEqual([])
  })

  it('用中文说明星标数字的含义', () => {
    const liveProject: Project = {
      id: 'gh-1',
      slug: 'live-one',
      title: '实时条目',
      tagline: '来自 GitHub 的一条记录',
      story: '仓库自述（原文）：a tiny app',
      category: 'tool',
      tags: [],
      stack: ['Rust'],
      maker: { name: 'someone', handle: 'someone' },
      links: [{ kind: 'repo', label: '查看源码', url: 'https://github.com/example/live-one' }],
      createdAt: '2026-01-01',
      likes: 0,
      stars: 500,
      featured: false,
      status: 'live',
      provenance: { source: 'github', repoFullName: 'example/live-one', htmlUrl: 'https://github.com/example/live-one' },
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage projects={[liveProject]} />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getAllByTitle('GitHub 星标').length).toBeGreaterThan(0)
    expect(screen.queryAllByTitle('GitHub stars')).toHaveLength(0)
  })
})

describe('HomePage 搜索排序', () => {
  const titleHit: Project = {
    id: 's1',
    slug: 's1',
    title: '潮汐时钟',
    tagline: '极简屏保',
    story: '无关内容',
    category: 'life',
    tags: [],
    stack: ['Svelte'],
    maker: { name: 'A', handle: 'a' },
    links: [{ kind: 'demo', label: '打开', url: 'https://example.com/a' }],
    createdAt: '2026-01-01',
    likes: 1,
    featured: false,
    status: 'live',
    provenance: { source: 'seed' },
  }
  const storyHit: Project = {
    ...titleHit,
    id: 's2',
    slug: 's2',
    title: '完全不同的作品',
    tagline: '无关介绍',
    story: '我只是想做一个潮汐时钟，结果做成了别的',
    likes: 9999,
  }

  it('ranks a title match above a story-only match while searching', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage projects={[storyHit, titleHit]} />} />
        </Routes>
      </MemoryRouter>,
    )
    await user.type(screen.getByRole('searchbox', { name: /搜索/ }), '潮汐时钟')
    const titles = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent ?? '')
    expect(titles[0]).toBe('潮汐时钟')
  })
})

describe('HomePage 锚点', () => {
  it('把「进入展馆」做成页内滚动，而不是让 hash 路由跳到 /hall', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
    const initialHash = window.location.hash

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage projects={seedProjects} />} />
          <Route path="*" element={<p>不该出现的兜底路由</p>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: /进入展馆/ }))

    expect(screen.queryByText('不该出现的兜底路由')).not.toBeInTheDocument()
    expect(screen.getByTestId('result-count')).toBeInTheDocument()
    expect(scrollSpy).toHaveBeenCalled()
    expect(window.location.hash).toBe(initialHash)
    scrollSpy.mockRestore()
  })
})
