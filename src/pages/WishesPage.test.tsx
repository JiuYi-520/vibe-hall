import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { WishesPage } from './WishesPage'
import { createWishBoard } from '../lib/wishBoard'
import { createIdentityBoard } from '../lib/identityStore'
import type { Wish } from '../data/wishTypes'
import { seedProjects } from '../data/seed'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

const wishes: Wish[] = [
  {
    id: 'seed-1',
    slug: 'seed-one',
    title: '想要一个自动整理划线的东西',
    brief: '把阅读器里的划线自动整理成卡片，按主题分组。',
    category: 'tool',
    tags: ['阅读'],
    wisher: { name: '小满', handle: 'xiaoman' },
    createdAt: '2026-09-01',
    status: 'open',
    cheers: 3,
    provenance: { source: 'seed' },
  },
  {
    id: 'seed-2',
    slug: 'seed-two',
    title: '想要一个恐龙分类互动图',
    brief: '给小学生看，可以点开每一种恐龙看时代和体型对比。',
    category: 'education',
    tags: ['教学'],
    wisher: { name: '王老师', handle: 'wang' },
    createdAt: '2026-09-08',
    status: 'claimed',
    claim: { maker: { name: 'Yui', handle: 'yui' }, note: '先做白垩纪', claimedAt: '2026-09-09' },
    cheers: 9,
    provenance: { source: 'seed' },
  },
  {
    id: 'seed-3',
    slug: 'seed-three',
    title: '想要一个跑步轨迹画',
    brief: '把跑步轨迹变成抽象画，可以导出图片。',
    category: 'visual',
    tags: ['运动'],
    wisher: { name: 'Nori', handle: 'nori' },
    createdAt: '2026-09-05',
    status: 'open',
    cheers: 5,
    provenance: { source: 'seed' },
  },
]

function renderPage(board = createWishBoard({ seeds: wishes, storage: memoryStorage() })) {
  render(
    <MemoryRouter>
      <WishesPage board={board} projects={seedProjects} />
    </MemoryRouter>,
  )
  return board
}

describe('WishesPage', () => {
  it('设置本机身份后，发愿表单自动带上署名', async () => {
    const user = userEvent.setup()
    const board = createWishBoard({ seeds: wishes, storage: memoryStorage() })
    const identity = createIdentityBoard({ storage: memoryStorage() })
    render(
      <MemoryRouter>
        <WishesPage board={board} identity={identity} projects={seedProjects} />
      </MemoryRouter>,
    )

    await act(async () => {
      identity.save({ nickname: '阿岛', handle: 'a-dao', hue: 268 })
    })
    await user.click(screen.getByRole('button', { name: /贴一个新愿望/ }))

    expect(screen.getByLabelText('署名')).toHaveValue('阿岛')
    expect(screen.getByLabelText('账号')).toHaveValue('a-dao')
  })

  it('列出全部愿望并给出状态统计', () => {
    renderPage()
    expect(screen.getByTestId('wish-count')).toHaveTextContent(/^3$/)
    expect(screen.getByTestId('wish-stat-open')).toHaveTextContent(/^2$/)
    expect(screen.getByTestId('wish-stat-claimed')).toHaveTextContent(/^1$/)
    expect(screen.getByTestId('wish-card-seed-one')).toBeInTheDocument()
  })

  it('按状态和关键词收窄列表', async () => {
    const user = userEvent.setup()
    renderPage()

    const statusGroup = screen.getByRole('group', { name: '按状态筛选' })
    await user.click(within(statusGroup).getByRole('button', { name: /待接单/ }))
    expect(screen.getByTestId('wish-count')).toHaveTextContent(/^2$/)
    expect(screen.queryByTestId('wish-card-seed-two')).not.toBeInTheDocument()

    await user.click(within(statusGroup).getByRole('button', { name: /待接单/ }))
    await user.type(screen.getByRole('searchbox', { name: /搜索愿望/ }), '恐龙')
    expect(screen.getByTestId('wish-count')).toHaveTextContent(/^1$/)
    expect(screen.getByTestId('wish-card-seed-two')).toBeInTheDocument()
  })

  it('可以给愿望加一个“我也想要”', async () => {
    const user = userEvent.setup()
    renderPage()
    const card = screen.getByTestId('wish-card-seed-one')
    await user.click(within(card).getByRole('button', { name: /我也想要/ }))
    expect(screen.getByTestId('wish-cheers-seed-one')).toHaveTextContent('4 人想要')
  })

  it('接单：填署名后愿望进入已接单并显示接单人', async () => {
    const user = userEvent.setup()
    renderPage()
    const card = screen.getByTestId('wish-card-seed-one')
    await user.click(within(card).getByRole('button', { name: '我来接单' }))

    await user.type(within(card).getByLabelText('接单人账号'), 'a-dao')
    await user.type(within(card).getByLabelText('一句话计划'), '先做导入和分组')
    await user.click(within(card).getByRole('button', { name: '确认接单' }))

    const updated = screen.getByTestId('wish-card-seed-one')
    expect(updated).toHaveTextContent('已接单')
    expect(updated).toHaveTextContent('a-dao')
    expect(screen.getByTestId('wish-stat-open')).toHaveTextContent(/^1$/)
  })

  it('接单缺署名时报错且不改变状态', async () => {
    const user = userEvent.setup()
    renderPage()
    const card = screen.getByTestId('wish-card-seed-one')
    await user.click(within(card).getByRole('button', { name: '我来接单' }))
    await user.click(within(card).getByRole('button', { name: '确认接单' }))
    expect(within(card).getByRole('alert')).toHaveTextContent('接单人')
    expect(screen.getByTestId('wish-stat-open')).toHaveTextContent(/^2$/)
  })

  it('交付：已接单的愿望可以关联一件展品', async () => {
    const user = userEvent.setup()
    renderPage()
    const card = screen.getByTestId('wish-card-seed-two')
    await user.click(within(card).getByRole('button', { name: '标记为已交付' }))
    await user.selectOptions(within(card).getByLabelText('关联作品'), 'neon-kanban')
    await user.click(within(card).getByRole('button', { name: '确认交付' }))

    const updated = screen.getByTestId('wish-card-seed-two')
    expect(updated).toHaveTextContent('已交付')
    expect(within(updated).getByRole('link', { name: /霓虹看板/ })).toBeInTheDocument()
    expect(screen.getByTestId('wish-stat-delivered')).toHaveTextContent(/^1$/)
  })

  it('可以贴一条新愿望，校验通过后置顶显示', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /贴一个新愿望/ }))

    const form = screen.getByTestId('wish-form')
    await user.type(within(form).getByLabelText('愿望标题'), '想要一个替我浇花的页面')
    await user.type(within(form).getByLabelText('愿望描述'), '按植物分别设置周期，到点提醒我，能打卡。')
    await user.type(within(form).getByLabelText('署名'), 'Ken')
    await user.type(within(form).getByLabelText('账号'), 'ken')
    await user.click(within(form).getByRole('button', { name: '贴到愿望墙' }))

    expect(screen.getByTestId('wish-count')).toHaveTextContent(/^4$/)
    const first = screen.getAllByTestId(/^wish-card-/)[0]
    expect(first).toHaveTextContent('替我浇花')
  })

  it('空表单会被拦下并列出问题', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /贴一个新愿望/ }))
    await user.click(within(screen.getByTestId('wish-form')).getByRole('button', { name: '贴到愿望墙' }))
    expect(within(screen.getByTestId('wish-form')).getByRole('alert')).toHaveTextContent('标题')
    expect(screen.getByTestId('wish-count')).toHaveTextContent(/^3$/)
  })
})
