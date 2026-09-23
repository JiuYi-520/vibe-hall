import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProjectPage } from './ProjectPage'
import { createInteractionBoard } from '../lib/interactionBoard'
import { createIdentityBoard } from '../lib/identityStore'
import { createCreditBoard } from '../lib/creditBoard'
import { seedProjects } from '../data/seed'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

function renderProject({ withIdentity = true, slug = 'neon-kanban' } = {}) {
  const interactions = createInteractionBoard({ storage: memoryStorage() })
  const identity = createIdentityBoard({ storage: memoryStorage() })
  const credits = createCreditBoard({ storage: memoryStorage() })
  if (withIdentity) identity.save({ nickname: '阿岛', handle: 'a-dao', bio: '', hue: 268 })
  render(
    <MemoryRouter initialEntries={[`/p/${slug}`]}>
      <Routes>
        <Route
          path="/p/:slug"
          element={<ProjectPage projects={seedProjects} interactions={interactions} identity={identity} credits={credits} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  return { interactions, identity, credits }
}

describe('ProjectPage 点赞', () => {
  it('点赞加一，再点取消，并标记按下状态', async () => {
    const user = userEvent.setup()
    renderProject()
    const likeButton = screen.getByRole('button', { name: /点赞/ })
    expect(likeButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(likeButton)
    expect(screen.getByRole('button', { name: /已赞/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('detail-likes')).toHaveTextContent('413')

    await user.click(screen.getByRole('button', { name: /已赞/ }))
    expect(screen.getByTestId('detail-likes')).toHaveTextContent('412')
    expect(screen.getByRole('button', { name: /点赞/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('点赞不需要身份', async () => {
    const user = userEvent.setup()
    renderProject({ withIdentity: false })
    await user.click(screen.getByRole('button', { name: /点赞/ }))
    expect(screen.getByTestId('detail-likes')).toHaveTextContent('413')
  })
})

describe('ProjectPage 评论', () => {
  it('发表评论会记积分', async () => {
    const user = userEvent.setup()
    const { credits } = renderProject()
    const before = credits.balance()
    await user.type(screen.getByLabelText('评论正文'), '记一笔积分看看。')
    await user.click(screen.getByRole('button', { name: '发表评论' }))
    expect(credits.balance()).toBe(before + 5)
  })

  it('列出演示评论，并统计总数', () => {
    renderProject()
    const section = screen.getByTestId('comment-section')
    expect(within(section).getByRole('heading', { name: /评论/ })).toHaveTextContent('2')
    expect(within(section).getByText(/拖拽的惯性很舒服/)).toBeInTheDocument()
  })

  it('用本机身份发表评论，新评论排在最前', async () => {
    const user = userEvent.setup()
    renderProject()
    await user.type(screen.getByLabelText('评论正文'), '这个霓虹残影我很喜欢。')
    await user.click(screen.getByRole('button', { name: '发表评论' }))

    const section = screen.getByTestId('comment-section')
    expect(within(section).getByRole('heading', { name: /评论/ })).toHaveTextContent('3')
    const items = within(section).getAllByTestId(/^comment-/)
    expect(items[0]).toHaveTextContent('这个霓虹残影我很喜欢')
    expect(items[0]).toHaveTextContent('阿岛')
  })

  it('空评论被拦下，不写入', async () => {
    const user = userEvent.setup()
    renderProject()
    await user.click(screen.getByRole('button', { name: '发表评论' }))
    expect(screen.getByRole('alert')).toHaveTextContent('评论')
    expect(within(screen.getByTestId('comment-section')).getByRole('heading', { name: /评论/ })).toHaveTextContent('2')
  })

  it('没有本机身份时提示先去设置，不能评论', async () => {
    renderProject({ withIdentity: false })
    expect(screen.getByText(/设置本机身份后可评论/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /去设置/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发表评论' })).toBeDisabled()
  })

  it('只能删除自己发的评论', async () => {
    const user = userEvent.setup()
    renderProject()
    await user.type(screen.getByLabelText('评论正文'), '先收藏，周末试试。')
    await user.click(screen.getByRole('button', { name: '发表评论' }))

    const mine = within(screen.getByTestId('comment-section')).getAllByTestId(/^comment-/)[0]
    await user.click(within(mine).getByRole('button', { name: '删除' }))

    const section = screen.getByTestId('comment-section')
    expect(within(section).queryByText(/先收藏，周末试试/)).not.toBeInTheDocument()
    expect(within(section).getByRole('heading', { name: /评论/ })).toHaveTextContent('2')
    // 演示评论不是本机发的，没有删除按钮
    expect(within(section).queryAllByRole('button', { name: '删除' })).toHaveLength(0)
  })
})
