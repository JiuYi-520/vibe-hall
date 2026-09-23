import { describe, expect, it } from 'vitest'
import type { Comment } from './interactionTypes'
import type { Project } from './types'
import {
  applyLikes,
  canDeleteComment,
  countComments,
  exportInteractions,
  listComments,
  makeLocalComment,
  toggleLikedMap,
  validateComment,
} from './interactions'

const yui = { name: 'Yui', handle: 'yui-type', hue: 318 }
const ada = { name: 'Ada', handle: 'ada-standup', hue: 212 }

function project(slug: string, likes: number): Project {
  return {
    id: slug,
    slug,
    title: slug,
    tagline: 't',
    story: 's',
    category: 'tool',
    tags: [],
    stack: ['React'],
    maker: { name: 'a', handle: 'a' },
    links: [{ kind: 'demo', label: 'open', url: 'https://example.com' }],
    createdAt: '2026-09-01',
    likes,
    featured: false,
    status: 'live',
    provenance: { source: 'seed' },
  }
}

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    projectSlug: 'neon-kanban',
    author: yui,
    body: '拖拽手感很顺，想知道你用的什么缓动。',
    createdAt: '2026-09-20',
    source: 'seed',
    ...overrides,
  }
}

describe('validateComment', () => {
  it('拦住空正文、过长正文与缺署名', () => {
    const codes = validateComment({ author: { name: '', handle: '', hue: 1 }, body: '   ' }).map((issue) => issue.code)
    expect(codes).toContain('empty-body')
    expect(codes).toContain('missing-author')
    expect(validateComment({ author: yui, body: '字'.repeat(500) }).map((issue) => issue.code)).toContain('long-body')
  })

  it('接受一条正常评论', () => {
    expect(validateComment({ author: yui, body: '这个留白我很喜欢，回头也想做一个。' })).toEqual([])
  })
})

describe('makeLocalComment', () => {
  it('生成本机评论并带上目标展品与时间', () => {
    const created = makeLocalComment('neon-kanban', ada, '  先收藏了，周末试试。  ', new Date('2026-09-22T10:00:00Z'), 1)
    expect(created.projectSlug).toBe('neon-kanban')
    expect(created.body).toBe('先收藏了，周末试试。')
    expect(created.source).toBe('local')
    expect(created.author.handle).toBe('ada-standup')
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(created.id).toContain('local-')
  })
})

describe('toggleLikedMap', () => {
  it('第一次点加一，再点取消，不修改原对象', () => {
    const empty: Record<string, boolean> = {}
    const liked = toggleLikedMap(empty, 'neon-kanban')
    expect(liked['neon-kanban']).toBe(true)
    expect(empty['neon-kanban']).toBeUndefined()

    const unliked = toggleLikedMap(liked, 'neon-kanban')
    expect(unliked['neon-kanban']).toBe(false)
  })
})

describe('applyLikes / countComments', () => {
  it('点赞后展品热度加一，取消后回到原值', () => {
    const projects = [project('neon-kanban', 10)]
    expect(applyLikes(projects, {})[0].likes).toBe(10)
    expect(applyLikes(projects, { 'neon-kanban': true })[0].likes).toBe(11)
    expect(applyLikes(projects, { 'neon-kanban': false })[0].likes).toBe(10)
  })

  it('评论数只算这条展品的', () => {
    const comments = [comment(), comment({ id: 'c2', projectSlug: 'pixel-farm' }), comment({ id: 'c3', source: 'local' })]
    expect(countComments(comments, 'neon-kanban')).toBe(2)
  })
})

describe('listComments', () => {
  it('本机评论排在最前，其后是种子评论', () => {
    const seed = [comment(), comment({ id: 'c9', createdAt: '2026-09-10' })]
    const local = [comment({ id: 'local-1', source: 'local', createdAt: '2026-09-21' })]
    expect(listComments(seed, local, 'neon-kanban').map((item) => item.id)).toEqual(['local-1', 'c1', 'c9'])
  })

  it('不混入别的展品的评论', () => {
    const seed = [comment(), comment({ id: 'other', projectSlug: 'pixel-farm' })]
    expect(listComments(seed, [], 'neon-kanban')).toHaveLength(1)
  })
})

describe('canDeleteComment', () => {
  it('只能删本机发的、且署名匹配的评论', () => {
    const local = comment({ source: 'local', author: ada })
    expect(canDeleteComment(local, { nickname: 'Ada', handle: 'ada-standup' })).toBe(true)
    expect(canDeleteComment(local, { nickname: 'Ada', handle: 'someone-else' })).toBe(false)
    expect(canDeleteComment(comment(), { nickname: 'Yui', handle: 'yui-type' })).toBe(false)
    expect(canDeleteComment(local, null)).toBe(false)
  })
})

describe('exportInteractions', () => {
  it('导出带版本、点赞与评论的 JSON', () => {
    const json = JSON.parse(
      exportInteractions({ liked: { 'neon-kanban': true }, comments: [comment({ source: 'local' })] }, '2026-09-22T00:00:00.000Z'),
    )
    expect(json.schema).toBe('vibe-hall.interactions.v1')
    expect(json.exportedAt).toBe('2026-09-22T00:00:00.000Z')
    expect(json.liked['neon-kanban']).toBe(true)
    expect(json.comments).toHaveLength(1)
  })
})
