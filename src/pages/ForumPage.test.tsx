import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ForumPage } from './ForumPage'
import { createForumBoard } from '../lib/forumBoard'
import { createIdentityBoard } from '../lib/identityStore'
import { createCreditBoard } from '../lib/creditBoard'
import type { ForumPost } from '../data/forumTypes'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

const author = { nickname: '小满', handle: 'xiaoman', hue: 212 }
const posts: ForumPost[] = [
  {
    id: 'p1',
    slug: 'p-one',
    title: '接单之后怎么验收比较公平？',
    body: '我做了一个愿望，接单人交付了但和我想要的不太一样，想听听大家怎么做验收。',
    kind: 'ask',
    author,
    createdAt: '2026-09-18',
    replies: [],
    likes: 2,
    source: 'seed',
  },
  {
    id: 'p2',
    slug: 'p-two',
    title: '招募：一起做遛狗路线看板',
    body: '想找人一起做，我负责数据，最好有人做前端。',
    kind: 'recruit',
    author,
    createdAt: '2026-09-12',
    replies: [{ id: 'r1', author, body: '我加入', createdAt: '2026-09-13', source: 'seed' }],
    likes: 9,
    source: 'seed',
  },
]

function renderPage({ withIdentity = true } = {}) {
  const forum = createForumBoard({ seeds: posts, storage: memoryStorage() })
  const identity = createIdentityBoard({ storage: memoryStorage() })
  const credits = createCreditBoard({ storage: memoryStorage() })
  if (withIdentity) identity.save({ nickname: '阿岛', handle: 'a-dao', bio: '', hue: 268 })
  render(
    <MemoryRouter>
      <ForumPage board={forum} identity={identity} credits={credits} />
    </MemoryRouter>,
  )
  return { forum, identity, credits }
}

describe('ForumPage', () => {
  it('发帖与回复都会记积分', async () => {
    const user = userEvent.setup()
    const { credits } = renderPage()
    const before = credits.balance()

    await user.click(screen.getByRole('button', { name: /发新帖/ }))
    const form = screen.getByTestId('post-form')
    await user.type(within(form).getByLabelText('标题'), '积分能干什么')
    await user.type(within(form).getByLabelText('正文'), '看到个人中心有积分和徽章商店，想问问大家怎么用。')
    await user.click(within(form).getByRole('button', { name: '发布' }))
    expect(credits.balance()).toBe(before + 10)

    const card = screen.getByTestId('post-p-one')
    await user.click(within(card).getByRole('button', { name: '回复' }))
    await user.type(within(card).getByLabelText('回复正文'), '我用来换徽章了')
    await user.click(within(card).getByRole('button', { name: '发表回复' }))
    expect(credits.balance()).toBe(before + 10 + 3)
  })

  it('列出帖子、统计与单机说明', () => {
    renderPage()
    expect(screen.getByTestId('forum-count')).toHaveTextContent(/^2$/)
    expect(screen.getByTestId('forum-stats')).toHaveTextContent('2')
    expect(screen.getByText(/只保存在本机/)).toBeInTheDocument()
    expect(screen.getByTestId('post-p-one')).toBeInTheDocument()
  })

  it('按分类与关键词收窄', async () => {
    const user = userEvent.setup()
    renderPage()
    const kinds = screen.getByRole('group', { name: '按分类筛选' })
    await user.click(within(kinds).getByRole('button', { name: /招募/ }))
    expect(screen.getByTestId('forum-count')).toHaveTextContent(/^1$/)
    expect(screen.queryByTestId('post-p-one')).not.toBeInTheDocument()

    await user.click(within(kinds).getByRole('button', { name: /招募/ }))
    await user.type(screen.getByRole('searchbox', { name: /搜索帖子/ }), '验收')
    expect(screen.getByTestId('forum-count')).toHaveTextContent(/^1$/)
  })

  it('用本机身份发帖并置顶', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /发新帖/ }))
    const form = screen.getByTestId('post-form')
    await user.type(within(form).getByLabelText('标题'), '记录：我的第一件展品')
    await user.type(within(form).getByLabelText('正文'), '用自然语言做了个晾衣提醒，把过程写下来。')
    await user.click(within(form).getByRole('button', { name: '发布' }))

    expect(screen.getByTestId('forum-count')).toHaveTextContent(/^3$/)
    expect(screen.getAllByTestId(/^post-/)[0]).toHaveTextContent('第一件展品')
    expect(screen.getAllByTestId(/^post-/)[0]).toHaveTextContent('阿岛')
  })

  it('没有本机身份时提示先去设置，并且不能发布', async () => {
    const user = userEvent.setup()
    renderPage({ withIdentity: false })
    await user.click(screen.getByRole('button', { name: /发新帖/ }))
    expect(screen.getByText(/先设置本机身份/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /去设置/ })).toBeInTheDocument()
  })

  it('可以回复帖子', async () => {
    const user = userEvent.setup()
    renderPage()
    const card = screen.getByTestId('post-p-one')
    await user.click(within(card).getByRole('button', { name: '回复' }))
    await user.type(within(card).getByLabelText('回复正文'), '先把验收标准写进愿望里')
    await user.click(within(card).getByRole('button', { name: '发表回复' }))
    expect(within(screen.getByTestId('post-p-one')).getByText(/验收标准写进愿望/)).toBeInTheDocument()
  })

  it('可以点赞', async () => {
    const user = userEvent.setup()
    renderPage()
    const card = screen.getByTestId('post-p-one')
    await user.click(within(card).getByRole('button', { name: /点赞/ }))
    expect(screen.getByTestId('post-likes-p-one')).toHaveTextContent('3')
  })
})
