import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MePage } from './MePage'
import { createIdentityBoard } from '../lib/identityStore'
import { createWishBoard } from '../lib/wishBoard'
import { createForumBoard } from '../lib/forumBoard'
import { createInteractionBoard } from '../lib/interactionBoard'
import { createCreditBoard } from '../lib/creditBoard'
import { BADGES } from '../data/credits'
import type { Wish } from '../data/wishTypes'
import type { ForumPost } from '../data/forumTypes'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set('vibe-hall:credits', initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

const seedWish: Wish = {
  id: 'w1',
  slug: 'w-one',
  title: '想要一个自动整理划线的东西',
  brief: '把阅读器里的划线自动整理成卡片，按主题分组。',
  category: 'tool',
  tags: [],
  wisher: { name: '小满', handle: 'xiaoman' },
  createdAt: '2026-09-01',
  status: 'open',
  cheers: 1,
  provenance: { source: 'seed' },
}

const seedPost: ForumPost = {
  id: 'p1',
  slug: 'p-one',
  title: '接单之后怎么验收比较公平？',
  body: '我做了一个愿望，交付的和预期不一样，想听大家的做法。',
  kind: 'ask',
  author: { nickname: '小满', handle: 'xiaoman', hue: 212 },
  createdAt: '2026-09-18',
  replies: [],
  likes: 2,
  source: 'seed',
}

function renderPage() {
  const identity = createIdentityBoard({ storage: memoryStorage() })
  const wishes = createWishBoard({ seeds: [seedWish], storage: memoryStorage() })
  const forum = createForumBoard({ seeds: [seedPost], storage: memoryStorage() })
  const interactions = createInteractionBoard({ storage: memoryStorage() })
  const credits = createCreditBoard({ storage: memoryStorage() })
  render(
    <MemoryRouter>
      <MePage identity={identity} wishes={wishes} forum={forum} interactions={interactions} credits={credits} />
    </MemoryRouter>,
  )
  return { identity, wishes, forum, interactions, credits }
}

describe('MePage', () => {
  it('没有身份时给出设置表单，并说明这不是账号', () => {
    renderPage()
    expect(screen.getByText(/不是账号/)).toBeInTheDocument()
    expect(screen.getByLabelText('昵称')).toBeInTheDocument()
  })

  it('保存身份后显示昵称与账号', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('昵称'), '阿岛')
    await user.type(screen.getByLabelText('账号'), 'a-dao')
    await user.type(screen.getByLabelText('一句话简介'), '用自然语言写前端')
    await user.click(screen.getByRole('button', { name: '保存身份' }))
    expect(screen.getByTestId('me-nickname')).toHaveTextContent('阿岛')
    expect(screen.getByTestId('me-handle')).toHaveTextContent('a-dao')
  })

  it('账号格式不对会报错且不保存', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('昵称'), '阿岛')
    await user.type(screen.getByLabelText('账号'), '中文账号')
    await user.click(screen.getByRole('button', { name: '保存身份' }))
    expect(screen.getByRole('alert')).toHaveTextContent('账号')
    expect(screen.queryByTestId('me-nickname')).not.toBeInTheDocument()
  })

  it('统计我本机的愿望、接单、帖子与回复', async () => {
    const user = userEvent.setup()
    const { wishes, forum } = renderPage()
    await user.type(screen.getByLabelText('昵称'), '阿岛')
    await user.type(screen.getByLabelText('账号'), 'a-dao')
    await user.click(screen.getByRole('button', { name: '保存身份' }))

    await act(async () => {
      wishes.createWish({
        title: '想要一个晾衣提醒看板',
        brief: '每天早上看一眼今天能不能晾衣服、几点最合适。',
        wisherName: '阿岛',
        wisherHandle: 'a-dao',
      })
      forum.reply('p1', { nickname: '阿岛', handle: 'a-dao', hue: 268 }, '先把验收标准写清')
    })

    expect(screen.getByTestId('me-wishes')).toHaveTextContent('1')
    expect(screen.getByTestId('me-replies')).toHaveTextContent('1')
  })

  it('可以导出本机数据', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('昵称'), '阿岛')
    await user.click(screen.getByRole('button', { name: '保存身份' }))
    await user.click(screen.getByRole('button', { name: /导出本机数据/ }))
    expect(screen.getByText(/已复制|复制失败/)).toBeInTheDocument()
  })

  it('导出的本机数据包含展品点赞与评论', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { interactions } = renderPage()

    await user.type(screen.getByLabelText('昵称'), '阿岛')
    await user.type(screen.getByLabelText('账号'), 'a-dao')
    await user.click(screen.getByRole('button', { name: '保存身份' }))
    await act(async () => {
      interactions.toggleLike('neon-kanban')
      interactions.addComment('neon-kanban', { name: '阿岛', handle: 'a-dao', hue: 268 }, '先收藏，周末试试。')
    })
    await user.click(screen.getByRole('button', { name: /导出本机数据/ }))

    const payload = JSON.parse(writeText.mock.calls[0][0])
    expect(payload.interactions.liked['neon-kanban']).toBe(true)
    expect(payload.interactions.comments).toHaveLength(1)
    expect(payload.credits.schema).toBe('vibe-hall.credits.v1')
    expect(payload.credits.balance).toBeGreaterThanOrEqual(120)
  })

  it('只填昵称没填账号时，也能统计我的愿望与帖子', async () => {
    const user = userEvent.setup()
    const { wishes, forum } = renderPage()
    await user.type(screen.getByLabelText('昵称'), '阿岛')
    await user.click(screen.getByRole('button', { name: '保存身份' }))

    await act(async () => {
      wishes.createWish({
        title: '想要一个晾衣提醒看板',
        brief: '每天早上看一眼今天能不能晾衣服、几点最合适。',
        wisherName: '阿岛',
        wisherHandle: '',
      })
      forum.createPost({
        title: '只有昵称也要能发帖',
        body: '这条帖子作者只填了昵称，没有账号。',
        kind: 'share',
        author: { nickname: '阿岛', handle: '', hue: 268 },
      })
    })

    expect(screen.getByTestId('me-wishes')).toHaveTextContent('1')
    expect(screen.getByTestId('me-posts')).toHaveTextContent('1')
  })

  it('清空本机数据会连身份一起清掉', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('昵称'), '阿岛')
    await user.click(screen.getByRole('button', { name: '保存身份' }))
    await user.click(screen.getByRole('button', { name: /清空本机数据/ }))
    expect(screen.queryByTestId('me-nickname')).not.toBeInTheDocument()
    expect(screen.getByLabelText('昵称')).toHaveValue('')
  })

  it('显示积分余额，并写明这是虚拟积分不是钱', () => {
    renderPage()
    expect(screen.getByTestId('credit-balance')).toHaveTextContent(/^120$/)
    expect(screen.getByText(/不是钱/)).toBeInTheDocument()
    expect(screen.getByText(/不能充值、不能提现/)).toBeInTheDocument()
  })

  it('可以用积分兑换徽章：扣分并标记已拥有', async () => {
    const user = userEvent.setup()
    renderPage()
    const badge = BADGES[0]
    const card = screen.getByTestId(`badge-${badge.id}`)
    await user.click(within(card).getByRole('button', { name: /兑换/ }))

    expect(screen.getByTestId('credit-balance')).toHaveTextContent(String(120 - badge.cost))
    expect(within(screen.getByTestId(`badge-${badge.id}`)).getByText('已拥有')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^credit-entry-/).length).toBeGreaterThan(1)
  })

  it('积分不够时兑换按钮禁用并写明原因', () => {
    const empty = JSON.stringify({ entries: [{ id: 'x', amount: 1, reason: 'welcome', note: '测试用', at: '2026-09-01' }], owned: [] })
    const identity = createIdentityBoard({ storage: memoryStorage() })
    const credits = createCreditBoard({ storage: memoryStorage(empty) })
    render(
      <MemoryRouter>
        <MePage identity={identity} credits={credits} />
      </MemoryRouter>,
    )
    const richest = [...BADGES].sort((a, b) => a.cost - b.cost)[0]
    const card = screen.getByTestId(`badge-${richest.id}`)
    expect(within(card).getByRole('button', { name: '积分不够' })).toBeDisabled()
    expect(screen.getByTestId('credit-balance')).toHaveTextContent(/^1$/)
  })

  it('流水里能看到每一笔收支', () => {
    renderPage()
    const entries = screen.getAllByTestId(/^credit-entry-/)
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0]).toHaveTextContent(/\+120|120/)
  })

  it('可以导出积分流水，载荷里写明是虚拟积分', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderPage()
    await user.click(screen.getByRole('button', { name: /导出流水/ }))
    const payload = JSON.parse(writeText.mock.calls[0][0])
    expect(payload.schema).toBe('vibe-hall.credits.v1')
    expect(payload.disclaimer).toContain('虚拟')
    expect(payload.balance).toBe(120)
  })
})
