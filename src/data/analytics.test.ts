import { describe, expect, it } from 'vitest'
import { buildLanguageStats, projectTrend, normalizeSnapshots } from './analytics'
import { buildStarBoard } from './stars'
import type { StarSnapshot } from './starTypes'
import { loadProjects } from './loadProjects'

const history: StarSnapshot[] = [
  { at: '2026-09-01T00:00:00Z', repos: { 'a/app': 100, 'b/app': 50 }, forks: { 'a/app': 10 } },
  { at: '2026-09-20T00:00:00Z', repos: { 'a/app': 90, 'b/app': 70, 'c/new': 20 },
    forks: { 'a/app': 12, 'b/app': 3 }, languages: { 'a/app': 'TypeScript', 'b/app': 'TypeScript', 'c/new': null } },
]
describe('真实统计边界', () => {
  it('非法时间、未来快照、重复时间不会制造增量', () => {
    const clean = normalizeSnapshots([...history, history[1], { at: 'bad', repos: {} },
      { at: '2099-01-01', repos: { 'a/app': 999 } }])
    expect(clean).toHaveLength(2)
  })
  it('语言汇总只统计选中仓库，不把缺失 Fork 当成零', () => {
    const rows = buildLanguageStats(history, ['a/app', 'b/app', 'c/new'], '30d')
    expect(rows.find((row) => row.language === 'TypeScript')).toMatchObject({ repos: 2, stars: 160, forks: 15, starGain: 10, forkGain: 2, forkCompared: 1 })
    expect(rows.find((row) => row.language === '未标注')).toMatchObject({ stars: 20, forks: null, starGain: null })
  })
  it('趋势保留真实下降与采集间隔，不填充缺失点', () => {
    expect(projectTrend(history, 'a/app', '30d').map((p) => [p.stars, p.forks])).toEqual([[100, 10], [90, 12]])
    expect(projectTrend(history, 'c/new', '30d')).toHaveLength(1)
    expect(projectTrend(history, 'a/app', '7d')).toHaveLength(1)
  })
  it('榜单用最新采集值算增量，不能混用构建时旧星标', () => {
    const original = loadProjects({ includeDemo: false }).projects[0]
    const project = { ...original, stars: 999, provenance: { ...original.provenance, repoFullName: 'a/app' } }
    const board = buildStarBoard({ projects: [project], history, window: '30d', kind: 'all', mode: 'gain' })
    expect(board.rows[0]).toMatchObject({ stars: 90, gain: -10 })
  })
})
