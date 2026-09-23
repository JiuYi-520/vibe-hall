import { describe, expect, it } from 'vitest'
import { createForumBoard } from './forumBoard'
import type { ForumPost } from '../data/forumTypes'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set('vibe-hall:forum', initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    raw: () => map.get('vibe-hall:forum') ?? null,
  }
}

const author = { nickname: '小满', handle: 'xiaoman', hue: 212 }
const seed: ForumPost = {
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
}

describe('createForumBoard', () => {
  it('发帖置顶、标记本机来源并写入存储', () => {
    const storage = memoryStorage()
    const board = createForumBoard({ seeds: [seed], storage })
    const result = board.createPost({ title: '我的第一件展品', body: '记录一下做晾衣提醒的全过程。', kind: 'showcase', author })
    expect(result.ok).toBe(true)
    expect(board.getState().posts[0].title).toContain('第一件展品')
    expect(board.getState().posts[0].source).toBe('local')
    expect(storage.raw()).toContain('第一件展品')
  })

  it('拒接不合法帖子并给出问题', () => {
    const board = createForumBoard({ seeds: [seed], storage: memoryStorage() })
    const result = board.createPost({ title: '', body: '短', kind: 'ask', author })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.code)).toContain('empty-title')
    expect(board.getState().posts).toHaveLength(1)
  })

  it('回帖、点赞会落盘，重开仍在', () => {
    const storage = memoryStorage()
    const first = createForumBoard({ seeds: [seed], storage })
    expect(first.reply('p1', author, '先把验收标准写进愿望').ok).toBe(true)
    first.like('p1')

    const reopened = createForumBoard({ seeds: [seed], storage })
    const post = reopened.getState().posts[0]
    expect(post.replies).toHaveLength(1)
    expect(post.likes).toBe(3)
  })

  it('存储损坏时回落而不是崩溃', () => {
    const board = createForumBoard({ seeds: [seed], storage: memoryStorage('{坏掉') })
    expect(board.getState().posts).toHaveLength(1)
  })

  it('重置清掉本机改动', () => {
    const storage = memoryStorage()
    const board = createForumBoard({ seeds: [seed], storage })
    board.like('p1')
    board.reset()
    expect(board.getState().posts[0].likes).toBe(2)
    expect(storage.raw()).toBeNull()
  })
})
