import { describe, expect, it } from 'vitest'
import { PROJECT_CATEGORIES, validateProjects } from './validateProjects'
import type { Project } from './types'
import { seedProjects } from './seed'

function bare(overrides: Partial<Project> = {}): Project {
  return {
    id: 'x1',
    slug: 'x-one',
    title: 'X One',
    tagline: 'tagline',
    story: 'story',
    category: 'tool',
    tags: [],
    stack: ['React'],
    maker: { name: 'Lin', handle: 'lin' },
    links: [{ kind: 'demo', label: 'Live', url: 'https://example.com' }],
    createdAt: '2026-01-01',
    likes: 0,
    featured: false,
    status: 'live',
    provenance: { source: 'seed' },
    ...overrides,
  }
}

describe('validateProjects', () => {
  it('accepts a well formed list', () => {
    expect(validateProjects([bare()])).toEqual([])
  })

  it('reports duplicate slugs', () => {
    const issues = validateProjects([bare(), bare({ id: 'x2' })])
    expect(issues.map((i) => i.code)).toContain('duplicate-slug')
  })

  it('reports missing required text and unknown categories', () => {
    const issues = validateProjects([
      bare({ tagline: '   ' }),
      bare({ id: 'x3', slug: 'x-three', category: 'nope' as Project['category'] }),
    ])
    expect(issues.map((i) => i.code).sort()).toEqual(['empty-field', 'unknown-category'])
  })

  it('reports links that are not http(s) or relative', () => {
    const issues = validateProjects([bare({ links: [{ kind: 'demo', label: 'bad', url: 'javascript:alert(1)' }] })])
    expect(issues.map((i) => i.code)).toEqual(['unsafe-link'])
  })

  it('keeps the shipped seed dataset valid', () => {
    const issues = validateProjects(seedProjects)
    expect(issues).toEqual([])
    expect(seedProjects.length).toBeGreaterThanOrEqual(12)
    expect(new Set(seedProjects.map((p) => p.slug)).size).toBe(seedProjects.length)
    expect(new Set(seedProjects.map((p) => p.category)).size).toBeGreaterThanOrEqual(3)
    expect(seedProjects.some((p) => p.featured)).toBe(true)
  })

  it('exposes the category list used by the validator', () => {
    expect(PROJECT_CATEGORIES.map((c) => c.id)).toContain('tool')
  })
})
