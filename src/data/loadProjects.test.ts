import { describe, expect, it } from 'vitest'
import { loadProjects } from './loadProjects'

describe('loadProjects', () => {
  it('生产模式只返回真实记录（不含演示示例）', () => {
    const bundle = loadProjects({ includeDemo: false })

    expect(bundle.projects.length).toBeGreaterThan(0)
    expect(bundle.projects.every((project) => project.provenance.source === 'github')).toBe(true)
    expect(bundle.projects.some((project) => project.id.startsWith('seed-'))).toBe(false)
  })

  it('开发模式会把演示示例补在真实记录之后', () => {
    const bundle = loadProjects({ includeDemo: true })

    expect(bundle.projects.some((project) => project.provenance.source === 'seed')).toBe(true)
    expect(bundle.projects.some((project) => project.provenance.source === 'github')).toBe(true)
  })

  it('真实记录与演示记录不会出现重复 slug', () => {
    const bundle = loadProjects({ includeDemo: true })
    const slugs = bundle.projects.map((project) => project.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
