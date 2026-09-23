import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { MePage } from './MePage'
import { createIdentityBoard } from '../lib/identityStore'
import { createWishBoard } from '../lib/wishBoard'
import { createForumBoard } from '../lib/forumBoard'
import type { Wish } from '../data/wishTypes'
import type { ForumPost } from '../data/forumTypes'

function memoryStorage() {
  const map = new Map<string, string>()
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
  render(
    <MemoryRouter>
      <MePage identity={identity} wishes={wishes} forum={forum} />
    </MemoryRouter>,
  )
  return { identity, wishes, forum }
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
})
