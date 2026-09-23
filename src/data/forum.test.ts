import { describe, expect, it } from 'vitest'
import type { ForumPost } from './forumTypes'
import {
  addReply,
  applyForumPatch,
  countMyContributions,
  emptyForumPatch,
  exportForum,
  filterPosts,
  forumStats,
  likePost,
  makeLocalPost,
  sortPosts,
  validateForumDraft,
} from './forum'

const author = { nickname: '小满', handle: 'xiaoman', hue: 212 }

function makePost(overrides: Partial<ForumPost> = {}): ForumPost {
  return {
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
    ...overrides,
  }
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

describe('validateForumDraft', () => {
  it('拦住空标题、过短正文与缺作者', () => {
    const codes = validateForumDraft({ title: '  ', body: '太短', kind: 'ask', author: { nickname: '', handle: '', hue: 212 } }).map(
      (issue) => issue.code,
    )
    expect(codes).toContain('empty-title')
    expect(codes).toContain('short-body')
    expect(codes).toContain('missing-author')
  })

  it('接受一条完整的帖子', () => {
    expect(validateForumDraft({ title: '接单之后怎么验收', body: '我做了一个愿望，交付的和预期不一样，想听大家的做法。', kind: 'ask', author })).toEqual([])
  })
})

describe('addReply', () => {
  it('回复需要正文和署名', () => {
    expect(addReply(makePost(), { nickname: '', handle: '', hue: 1 }, '你好')).toEqual({ ok: false, reason: 'missing-author' })
    expect(addReply(makePost(), author, '   ')).toEqual({ ok: false, reason: 'empty-reply' })
  })

  it('回复成功会追加到末尾并带时间', () => {
    const result = addReply(makePost(), author, '先把验收标准写在愿望里')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.post.replies).toHaveLength(1)
    expect(result.post.replies[0].body).toContain('验收标准')
    expect(result.post.replies[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
    expect(result.post.replies[0].source).toBe('local')
  })

  it('不修改原帖子对象', () => {
    const post = makePost()
    addReply(post, author, '一句回复足够长')
    expect(post.replies).toHaveLength(0)
  })
})

describe('likePost', () => {
  it('点赞加一并保持不可变', () => {
    const post = makePost({ likes: 2 })
    expect(likePost(post).likes).toBe(3)
    expect(post.likes).toBe(2)
  })
})

describe('applyForumPatch', () => {
  const seeds = [makePost(), makePost({ id: 'p2', slug: 'p-two', title: '分享一个接单经验', kind: 'share' })]

  it('本机新帖排在最前', () => {
    const created = makeLocalPost(
      { title: '我的第一件展品', body: '用自然语言做了一个晾衣提醒，整个过程记录在这里。', kind: 'showcase', author },
      new Date(),
      1,
    )
    const merged = applyForumPatch(seeds, { ...emptyForumPatch(), created: [created] })
    expect(merged[0].slug).toBe(created.slug)
    expect(merged[0].source).toBe('local')
    expect(merged).toHaveLength(3)
  })

  it('本机回复与点赞叠加到对应帖子上', () => {
    const patch = {
      ...emptyForumPatch(),
      replies: { p1: [{ id: 'r1', author, body: '先说清验收标准', createdAt: daysAgo(1), source: 'local' as const }] },
      likes: { p1: 3 },
    }
    const merged = applyForumPatch(seeds, patch)
    const post = merged.find((item) => item.id === 'p1')!
    expect(post.replies).toHaveLength(1)
    expect(post.likes).toBe(5)
  })

  it('忽略指向不存在帖子的改动', () => {
    const merged = applyForumPatch(seeds, { ...emptyForumPatch(), likes: { ghost: 9 } })
    expect(merged).toHaveLength(2)
  })
})

describe('filterPosts / sortPosts / forumStats', () => {
  const today = new Date().toISOString().slice(0, 10)
  const posts = [
    makePost({ id: 'a', slug: 'a', createdAt: today, likes: 1 }),
    makePost({
      id: 'b',
      slug: 'b',
      title: '招募：一起做遛狗路线看板',
      kind: 'recruit',
      createdAt: daysAgo(5),
      likes: 9,
      replies: [{ id: 'r', author, body: '我加入', createdAt: daysAgo(4), source: 'seed' }],
    }),
    makePost({ id: 'c', slug: 'c', title: '闲聊：你用什么工具', kind: 'chat', createdAt: daysAgo(9), likes: 4 }),
  ]

  it('按分类与关键词筛选', () => {
    expect(filterPosts(posts, { kinds: ['recruit'] }).map((post) => post.slug)).toEqual(['b'])
    expect(filterPosts(posts, { query: '遛狗' }).map((post) => post.slug)).toEqual(['b'])
    expect(filterPosts(posts, { query: '小满' }).map((post) => post.slug)).toEqual(['a', 'b', 'c'])
  })

  it('支持最新、最热、回复最多三种排序', () => {
    expect(sortPosts(posts, 'newest').map((post) => post.slug)).toEqual(['a', 'b', 'c'])
    expect(sortPosts(posts, 'likes').map((post) => post.slug)).toEqual(['b', 'c', 'a'])
    expect(sortPosts(posts, 'active').map((post) => post.slug)).toEqual(['b', 'a', 'c'])
  })

  it('统计帖子、回复、作者与今日新增', () => {
    const stats = forumStats(posts)
    expect(stats.posts).toBe(3)
    expect(stats.replies).toBe(1)
    expect(stats.authors).toBe(1)
    expect(stats.today).toBe(1)
  })
})

describe('countMyContributions', () => {
  it('按账号统计我的发帖与回帖', () => {
    const posts = [
      makePost({ id: 'a', slug: 'a', source: 'local' }),
      makePost({
        id: 'b',
        slug: 'b',
        author: { nickname: '别人', handle: 'other', hue: 1 },
        replies: [{ id: 'r', author, body: '我来回一句', createdAt: '2026-09-19', source: 'local' }],
      }),
    ]
    expect(countMyContributions(posts, 'xiaoman')).toEqual({ posts: 1, replies: 1 })
  })
})

describe('exportForum', () => {
  it('导出带版本与统计的 JSON', () => {
    const json = JSON.parse(exportForum([makePost()], '2026-09-22T00:00:00.000Z'))
    expect(json.schema).toBe('vibe-hall.forum.v1')
    expect(json.exportedAt).toBe('2026-09-22T00:00:00.000Z')
    expect(json.count).toBe(1)
  })
})
