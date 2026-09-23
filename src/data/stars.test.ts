import { describe, expect, it } from 'vitest'
import type { Project } from './types'
import type { StarSnapshot } from './starTypes'
import { buildStarBoard, classifyRepoKind, dailyRate } from './stars'

function ghProject(overrides: Partial<Project> & { fullName: string; stars: number }): Project {
  const { fullName, stars, ...rest } = overrides
  return {
    id: `gh-${fullName}`,
    slug: fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: fullName.split('/')[1],
    tagline: '仓库自述（原文）：something',
    story: '仓库自述（原文）：something',
    category: 'ai',
    tags: [],
    stack: ['TypeScript'],
    maker: { name: fullName.split('/')[0], handle: fullName.split('/')[0] },
    links: [{ kind: 'repo', label: '查看源码', url: `https://github.com/${fullName}` }],
    createdAt: '2020-01-01',
    likes: 0,
    stars,
    featured: false,
    status: 'live',
    provenance: { source: 'github', repoFullName: fullName, htmlUrl: `https://github.com/${fullName}` },
    ...rest,
  }
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

describe('classifyRepoKind', () => {
  it('把技能包、软件、库与清单分开', () => {
    expect(classifyRepoKind({ name: 'skills', description: 'Skills for Real Engineers', topics: ['claude', 'skills'] })).toBe('skill')
    expect(classifyRepoKind({ name: 'open-design', description: 'Best DeepSeek Harness Design Plugin', topics: ['plugin'] })).toBe('skill')
    expect(classifyRepoKind({ name: 'what-to-eat', description: '一个基于 AI 的智能菜谱生成平台', topics: [] })).toBe('app')
    expect(classifyRepoKind({ name: 'tower-of-time', description: 'Vibe coded Tower Defense game', topics: ['game'] })).toBe('app')
    expect(classifyRepoKind({ name: 'context7', description: 'Up-to-date code documentation SDK for LLMs', topics: ['sdk'] })).toBe('library')
    expect(classifyRepoKind({ name: 'awesome-vibe-coding', description: 'A curated list of vibe coding references', topics: [] })).toBe('list')
    expect(classifyRepoKind({ name: 'mystery', description: 'nothing matches here', topics: [] })).toBe('other')
  })

  it('把开发工具类仓库也归到软件应用，而不是其它', () => {
    expect(
      classifyRepoKind({ name: 'codeg', description: 'Collaborative multi-agent AI coding workspace: aggregate sessions', topics: [] }),
    ).toBe('app')
    expect(
      classifyRepoKind({ name: 'crystal', description: 'Run multiple Codex and Claude Code AI sessions in parallel git worktrees', topics: [] }),
    ).toBe('app')
    expect(classifyRepoKind({ name: 'fanbox', description: 'vibe coding 的驾驶舱：左边文件，右边/下边终端', topics: [] })).toBe('app')
  })
})

describe('dailyRate', () => {
  it('按创建至今的天数算平均每天涨多少星', () => {
    expect(dailyRate(100, daysAgo(50))).toBe(2)
    expect(dailyRate(10, daysAgo(1))).toBe(10)
  })

  it('创建时间在未来或缺失时返回 0，而不是负数或 NaN', () => {
    expect(dailyRate(50, new Date(Date.now() + 86_400_000).toISOString())).toBe(0)
    expect(dailyRate(50, 'not-a-date')).toBe(0)
  })
})

describe('buildStarBoard', () => {
  const projects = [
    ghProject({ fullName: 'a/skills', stars: 300, createdAt: daysAgo(100), title: 'Skills' }),
    ghProject({ fullName: 'b/app', stars: 500, createdAt: daysAgo(10), title: 'App' }),
    ghProject({ fullName: 'c/lib', stars: 200, createdAt: daysAgo(200), title: 'Lib' }),
  ]
  const history: StarSnapshot[] = [
    { at: daysAgo(30), repos: { 'a/skills': 200, 'b/app': 480, 'c/lib': 190 } },
    { at: daysAgo(1), repos: { 'a/skills': 300, 'b/app': 500, 'c/lib': 200 } },
  ]

  it('用两次快照算出窗口内增量并据此排序', () => {
    const board = buildStarBoard({ projects, history, window: '30d', kind: 'all', mode: 'gain' })
    expect(board.hasGain).toBe(true)
    expect(board.rows.map((row) => row.fullName)).toEqual(['a/skills', 'b/app', 'c/lib'])
    expect(board.rows[0].gain).toBe(100)
    expect(board.rows[1].gain).toBe(20)
  })

  it('窗口里不足两次快照时不给增量，并回落到总星标排序', () => {
    const board = buildStarBoard({ projects, history, window: '7d', kind: 'all', mode: 'gain' })
    expect(board.hasGain).toBe(false)
    expect(board.rows.map((row) => row.fullName)).toEqual(['b/app', 'a/skills', 'c/lib'])
    expect(board.rows.every((row) => row.gain === null)).toBe(true)
  })

  it('种子/非 GitHub 条目不会进榜', () => {
    const seedProject: Project = {
      ...ghProject({ fullName: 'seed/x', stars: 9 }),
      id: 'seed-1',
      provenance: { source: 'seed' },
    }
    const board = buildStarBoard({ projects: [...projects, seedProject], history, window: 'all', kind: 'all', mode: 'total' })
    expect(board.rows.map((row) => row.fullName)).not.toContain('seed/x')
  })

  it('按分类筛选，并按日均、总星标排序', () => {
    const skillsOnly = buildStarBoard({ projects, history, window: '30d', kind: 'skill', mode: 'gain' })
    expect(skillsOnly.rows.map((row) => row.fullName)).toEqual(['a/skills'])

    const byRate = buildStarBoard({ projects, history, window: '30d', kind: 'all', mode: 'rate' })
    expect(byRate.rows.map((row) => row.fullName)).toEqual(['b/app', 'a/skills', 'c/lib'])
    expect(byRate.rows[0].dailyRate).toBe(50)

    const byTotal = buildStarBoard({ projects, history, window: '30d', kind: 'all', mode: 'total' })
    expect(byTotal.rows.map((row) => row.fullName)).toEqual(['b/app', 'a/skills', 'c/lib'])
  })

  it('老快照里没有的仓库增量留空，但仍然按存量排进去', () => {
    const fresh = ghProject({ fullName: 'd/new', stars: 90, createdAt: daysAgo(3), title: 'New' })
    const board = buildStarBoard({ projects: [...projects, fresh], history, window: '30d', kind: 'all', mode: 'gain' })
    const row = board.rows.find((item) => item.fullName === 'd/new')!
    expect(row.gain).toBeNull()
    expect(board.rows[board.rows.length - 1].fullName).toBe('d/new')
  })

  it('报告参与统计的快照数量与时间范围', () => {
    const board = buildStarBoard({ projects, history, window: '30d', kind: 'all', mode: 'gain' })
    expect(board.snapshotCount).toBe(2)
    expect(board.earliest).toBe(history[0].at)
    expect(board.latest).toBe(history[1].at)
  })
})
