import { describe, expect, it } from 'vitest'
import { coverSources, githubCoverUrl, resolveCoverUrl } from './cover'
import type { Project } from './types'

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'gh-1',
    slug: 'xintaofei-codeg',
    title: 'Codeg',
    tagline: '协同多智能体编码工作台',
    story: '仓库自述（原文）：…',
    category: 'ai',
    tags: ['agent'],
    stack: ['TypeScript'],
    maker: { name: 'xintaofei', handle: 'xintaofei' },
    links: [],
    createdAt: '2026-01-01',
    likes: 0,
    stars: 3665,
    featured: true,
    status: 'live',
    provenance: { source: 'github', repoFullName: 'xintaofei/codeg' },
    ...overrides,
  }
}

describe('githubCoverUrl', () => {
  it('用仓库全名拼出 GitHub 官方预览图地址', () => {
    expect(githubCoverUrl('xintaofei/codeg')).toBe(
      'https://opengraph.githubassets.com/1/xintaofei/codeg',
    )
  })
})

describe('resolveCoverUrl', () => {
  it('GitHub 记录按仓库全名派生真实封面', () => {
    expect(resolveCoverUrl(project())).toBe('/api/cover/xintaofei/codeg')
  })

  it('显式 coverImageUrl 优先于派生值', () => {
    expect(resolveCoverUrl(project({ coverImageUrl: 'https://cdn.example.com/a.png' }))).toBe(
      'https://cdn.example.com/a.png',
    )
  })

  it('演示记录没有真实封面', () => {
    expect(
      resolveCoverUrl(project({ provenance: { source: 'seed', note: '演示示例数据' } })),
    ).toBeUndefined()
  })
})

describe('coverSources', () => {
  it('GitHub 记录优先用本站缓存，再退回 GitHub 原图', () => {
    expect(coverSources(project())).toEqual([
      '/api/cover/xintaofei/codeg',
      'https://opengraph.githubassets.com/1/xintaofei/codeg',
    ])
  })

  it('显式 coverImageUrl 只有一级来源', () => {
    expect(coverSources(project({ coverImageUrl: 'https://cdn.example.com/a.png' }))).toEqual([
      'https://cdn.example.com/a.png',
    ])
  })

  it('演示记录没有任何真实图片来源', () => {
    expect(coverSources(project({ provenance: { source: 'seed', note: '演示' } }))).toEqual([])
  })
})
