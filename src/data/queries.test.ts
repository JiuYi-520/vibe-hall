import { describe, expect, it } from 'vitest'
import type { Project } from './types'
import {
  buildFacets,
  computeStats,
  filterProjects,
  pickFeatured,
  rankProjects,
  relevanceScore,
  sortProjects,
  trendingScore,
} from './queries'

function makeProject(overrides: Partial<Project> & Pick<Project, 'id' | 'slug' | 'title'>): Project {
  return {
    id: overrides.id,
    slug: overrides.slug,
    title: overrides.title,
    tagline: overrides.tagline ?? 'a small tool',
    story: overrides.story ?? 'made by prompting',
    category: overrides.category ?? 'tool',
    tags: overrides.tags ?? [],
    stack: overrides.stack ?? ['React'],
    maker: overrides.maker ?? { name: 'Lin', handle: 'lin' },
    links: overrides.links ?? [{ kind: 'demo', label: 'Live', url: 'https://example.com' }],
    createdAt: overrides.createdAt ?? '2026-01-01',
    likes: overrides.likes ?? 0,
    stars: overrides.stars,
    featured: overrides.featured ?? false,
    status: overrides.status ?? 'live',
    provenance: overrides.provenance ?? { source: 'seed' },
  }
}

const corpus: Project[] = [
  makeProject({
    id: 'p1',
    slug: 'neon-kanban',
    title: 'Neon Kanban',
    tagline: '看板工具，带霓虹动效',
    category: 'tool',
    stack: ['React', 'Vite'],
    tags: ['动效'],
    createdAt: '2026-09-01',
    likes: 120,
    stars: 300,
    featured: true,
  }),
  makeProject({
    id: 'p2',
    slug: 'pixel-farm',
    title: 'Pixel Farm',
    tagline: '一个像素农场小游戏',
    category: 'game',
    stack: ['Canvas', 'TypeScript'],
    createdAt: '2026-08-01',
    likes: 40,
    stars: 900,
  }),
  makeProject({
    id: 'p3',
    slug: 'chem-lab',
    title: 'Chemistry Lab',
    tagline: '中学化学实验模拟',
    category: 'education',
    stack: ['React', 'Three.js'],
    tags: ['教学'],
    createdAt: '2025-12-01',
    likes: 8,
    stars: 3,
    status: 'wip',
  }),
]

describe('filterProjects', () => {
  it('returns every project when no filter is set', () => {
    expect(filterProjects(corpus, {})).toHaveLength(3)
  })

  it('matches free text against title, tagline, stack and tags case-insensitively', () => {
    expect(filterProjects(corpus, { query: 'kanban' }).map((p) => p.slug)).toEqual(['neon-kanban'])
    expect(filterProjects(corpus, { query: '霓虹' }).map((p) => p.slug)).toEqual(['neon-kanban'])
    expect(filterProjects(corpus, { query: 'three.js' }).map((p) => p.slug)).toEqual(['chem-lab'])
    expect(filterProjects(corpus, { query: '教学' }).map((p) => p.slug)).toEqual(['chem-lab'])
    expect(filterProjects(corpus, { query: '  KANBAN  ' }).map((p) => p.slug)).toEqual(['neon-kanban'])
  })

  it('treats multiple categories as a union and other facets as an intersection', () => {
    const byCategory = filterProjects(corpus, { categories: ['game', 'education'] })
    expect(byCategory.map((p) => p.slug).sort()).toEqual(['chem-lab', 'pixel-farm'])

    const intersected = filterProjects(corpus, { categories: ['game', 'education'], stack: ['React'] })
    expect(intersected.map((p) => p.slug)).toEqual(['chem-lab'])
  })

  it('filters by status and by featured flag', () => {
    expect(filterProjects(corpus, { statuses: ['wip'] }).map((p) => p.slug)).toEqual(['chem-lab'])
    expect(filterProjects(corpus, { onlyFeatured: true }).map((p) => p.slug)).toEqual(['neon-kanban'])
  })
})

describe('sortProjects', () => {
  it('sorts newest first without mutating the input', () => {
    const input = [...corpus]
    expect(sortProjects(input, 'newest').map((p) => p.slug)).toEqual(['neon-kanban', 'pixel-farm', 'chem-lab'])
    expect(input.map((p) => p.slug)).toEqual(['neon-kanban', 'pixel-farm', 'chem-lab'])
    expect(sortProjects(corpus, 'oldest').map((p) => p.slug)).toEqual(['chem-lab', 'pixel-farm', 'neon-kanban'])
  })

  it('sorts by stars with missing stars ranked last', () => {
    const withMissing = [...corpus, makeProject({ id: 'p4', slug: 'no-stars', title: 'No Stars', stars: undefined })]
    expect(sortProjects(withMissing, 'stars').map((p) => p.slug)).toEqual(['pixel-farm', 'neon-kanban', 'chem-lab', 'no-stars'])
  })

  it('ranks a fresh active project above an old quiet one when sorting by heat', () => {
    const ready = makeProject({ id: 'p5', slug: 'fresh-hot', title: 'Fresh Hot', likes: 300, stars: 100, createdAt: new Date().toISOString().slice(0, 10) })
    const stale = makeProject({ id: 'p6', slug: 'old-quiet', title: 'Old Quiet', likes: 5, stars: 5, createdAt: '2020-01-01' })
    expect(trendingScore(ready)).toBeGreaterThan(trendingScore(stale))
    expect(sortProjects([stale, ready], 'trending').map((p) => p.slug)).toEqual(['fresh-hot', 'old-quiet'])
  })
})

describe('facets and stats', () => {
  it('counts categories and stacks, largest first then alphabetically', () => {
    const facets = buildFacets(corpus)
    expect(facets.categories).toEqual([
      { id: 'education', count: 1 },
      { id: 'game', count: 1 },
      { id: 'tool', count: 1 },
    ])
    expect(facets.stack[0]).toEqual({ name: 'React', count: 2 })
    expect(facets.stack.map((s) => s.name)).toContain('Three.js')
  })

  it('summarises the hall size', () => {
    const stats = computeStats(corpus)
    expect(stats.projects).toBe(3)
    expect(stats.makers).toBe(1)
    expect(stats.stacks).toBe(5)
    expect(stats.reactions).toBe(168)
  })
})

describe('relevance ranking', () => {
  const titleHit = makeProject({ id: 'r1', slug: 'title-hit', title: '潮汐时钟', tagline: '极简屏保' })
  const storyHit = makeProject({
    id: 'r2',
    slug: 'story-hit',
    title: '别的作品',
    tagline: '无关介绍',
    story: '我只是想做一个潮汐时钟，结果做成了别的东西',
  })
  const stackHit = makeProject({ id: 'r3', slug: 'stack-hit', title: '看板', stack: ['潮汐时钟'], tagline: '无关' })

  it('scores a title hit above a story hit', () => {
    expect(relevanceScore(titleHit, '潮汐')).toBeGreaterThan(relevanceScore(storyHit, '潮汐'))
  })

  it('orders matches by relevance and falls back to heat for ties', () => {
    expect(rankProjects([storyHit, stackHit, titleHit], '潮汐').map((p) => p.slug)).toEqual([
      'title-hit',
      'stack-hit',
      'story-hit',
    ])
  })

  it('keeps the incoming order when the query is empty', () => {
    const input = [storyHit, titleHit, stackHit]
    expect(rankProjects(input, '   ').map((p) => p.slug)).toEqual(input.map((p) => p.slug))
  })
})

describe('pickFeatured', () => {
  it('spreads featured entries across categories before repeating one', () => {
    const hotTool = makeProject({ id: 'f1', slug: 'tool-hot', title: '工具一', category: 'tool', likes: 900 })
    const warmTool = makeProject({ id: 'f2', slug: 'tool-warm', title: '工具二', category: 'tool', likes: 800 })
    const toolThin = makeProject({ id: 'f3', slug: 'tool-thin', title: '工具三', category: 'tool', likes: 700 })
    const game = makeProject({ id: 'f4', slug: 'game-one', title: '游戏一', category: 'game', likes: 100 })
    const visual = makeProject({ id: 'f5', slug: 'visual-one', title: '视觉一', category: 'visual', likes: 90 })

    const picked = pickFeatured([hotTool, warmTool, toolThin, game, visual], 4)
    expect(picked).toHaveLength(4)
    expect(picked.map((p) => p.slug)).toContain('game-one')
    expect(picked.map((p) => p.slug)).toContain('visual-one')
    expect(picked.filter((p) => p.category === 'tool')).toHaveLength(2)
    expect(picked.map((p) => p.slug)).not.toContain('tool-thin')
  })
})
