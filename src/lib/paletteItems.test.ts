import { describe, expect, it } from 'vitest'
import { buildPaletteItems, filterPaletteItems } from './paletteItems'
import type { Project } from '../data/types'
import type { ForumPost } from '../data/forumTypes'
import type { Wish } from '../data/wishTypes'

function project(slug: string, title: string, tagline: string): Project {
  return {
    id: slug,
    slug,
    title,
    tagline,
    story: 'x',
    category: 'tool',
    tags: [],
    stack: ['React'],
    maker: { name: '阿岛', handle: 'a-dao' },
    links: [{ kind: 'demo', label: '打开', url: 'https://example.com' }],
    createdAt: '2026-09-01',
    likes: 1,
    featured: false,
    status: 'live',
    provenance: { source: 'seed' },
  }
}

const wish: Wish = {
  id: 'w1',
  slug: 'w-one',
  title: '想要一个晾衣提醒看板',
  brief: '每天早上看一眼今天能不能晾衣服。',
  category: 'life',
  tags: [],
  wisher: { name: '小满', handle: 'xiaoman' },
  createdAt: '2026-09-10',
  status: 'open',
  cheers: 1,
  provenance: { source: 'seed' },
}

const post: ForumPost = {
  id: 'p1',
  slug: 'p-one',
  title: '接单之后怎么验收',
  body: '想听大家的做法。',
  kind: 'ask',
  author: { nickname: '小满', handle: 'xiaoman', hue: 212 },
  createdAt: '2026-09-11',
  replies: [],
  likes: 0,
  source: 'seed',
}

describe('buildPaletteItems', () => {
  it('把页面、展品、愿望、帖子都收进同一个面板', () => {
    const items = buildPaletteItems({ projects: [project('tide-clock', '潮汐时钟', '极简屏保')], wishes: [wish], posts: [post] })
    const kinds = new Set(items.map((item) => item.kind))
    expect(kinds).toEqual(new Set(['page', 'project', 'wish', 'post']))
    expect(items.find((item) => item.id === 'page:/forum')?.label).toBe('论坛')
  })

  it('页面带路径，其它条目带跳转 id', () => {
    const items = buildPaletteItems({ projects: [project('tide-clock', '潮汐时钟', '极简屏保')], wishes: [wish], posts: [post] })
    expect(items.find((item) => item.kind === 'page')?.path).toMatch(/^\//)
    expect(items.find((item) => item.kind === 'project')?.id).toBe('project:tide-clock')
  })
})

describe('filterPaletteItems', () => {
  const items = buildPaletteItems({
    projects: [project('tide-clock', '潮汐时钟', '极简屏保'), project('neon-kanban', '霓虹看板', '会呼吸的看板')],
    wishes: [wish],
    posts: [post],
  })

  it('空查询返回全部', () => {
    expect(filterPaletteItems(items, '')).toHaveLength(items.length)
  })

  it('标题命中排在副标题命中前面', () => {
    const found = filterPaletteItems(items, '看板')
    expect(found[0].label).toBe('霓虹看板')
    expect(found.map((item) => item.label)).toContain('想要一个晾衣提醒看板')
  })

  it('搜得到页面', () => {
    expect(filterPaletteItems(items, '论坛').map((item) => item.id)).toContain('page:/forum')
    expect(filterPaletteItems(items, '升星').map((item) => item.label)).toContain('升星榜')
  })

  it('无匹配时返回空数组', () => {
    expect(filterPaletteItems(items, 'zzzz-不存在')).toEqual([])
  })
})
