import type { Project } from './types'
import type { RepoKind, StarBoard, StarMode, StarRow, StarSnapshot, StarWindow } from './starTypes'
import { KIND_ORDER, STAR_WINDOW_META } from './starTypes'
import { normalizeSnapshots, windowSnapshots } from './analytics'

export type {
  RepoKind,
  StarBoard,
  StarMode,
  StarRow,
  StarSnapshot,
  StarWindow,
} from './starTypes'
export { KIND_LABEL, KIND_ORDER, STAR_MODE_LABEL, STAR_WINDOW_META } from './starTypes'

const MS_PER_DAY = 86_400_000

/** 分类规则按优先级匹配：清单 > 技能包 > 软件 > 库，都不中就是其它。 */
const KIND_RULES: { kind: RepoKind; pattern: RegExp }[] = [
  { kind: 'list', pattern: /(awesome|curated|list of|项目列表|合集|资源(大全|库|汇总|整理)?|collection|directory|roadmap)/i },
  { kind: 'skill', pattern: /(\bskills?\b|agent skills?|技能|prompt ?(pack|库|集)|mcp|plugin|插件|harness|extension|ruleset|\brules\b)/i },
  {
    kind: 'app',
    pattern:
      /(\bapp\b|application|software|desktop|client|web ?app|网页|小程序|工具|\btools?\b|dashboard|看板|游戏|\bgame\b|编辑器|editor|平台|platform|studio|generator|生成器|workspace|sessions?|terminal|终端|驾驶舱|cockpit|worktree)/i,
  },
  { kind: 'library', pattern: /(library|框架|framework|\bsdk\b|engine|引擎|\bcli\b|toolkit|runtime|中间件|middleware)/i },
]

export function classifyRepoKind(input: { name: string; description: string; topics?: string[] }): RepoKind {
  const blob = `${input.name} ${input.description} ${(input.topics ?? []).join(' ')}`
  for (const rule of KIND_RULES) {
    if (rule.pattern.test(blob)) return rule.kind
  }
  return 'other'
}

export function dailyRate(stars: number, createdAt: string, now = Date.now()): number {
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return 0
  const days = (now - created) / MS_PER_DAY
  if (!Number.isFinite(days) || days <= 0) return 0
  return Math.round((stars / days) * 10) / 10
}

export function windowDays(window: StarWindow): number | null {
  return STAR_WINDOW_META.find((item) => item.id === window)?.days ?? null
}

function toRow(project: Project, gain: number | null, now: number): StarRow {
  const fullName = project.provenance.repoFullName ?? project.slug
  return {
    fullName,
    title: project.title,
    owner: project.maker.name,
    avatarUrl: project.maker.avatarUrl,
    url: project.provenance.htmlUrl ?? project.links[0]?.url ?? '',
    description: project.tagline.replace(/^仓库自述（原文）：/, ''),
    kind: classifyRepoKind({ name: fullName, description: project.tagline, topics: project.tags }),
    stars: project.stars ?? 0,
    gain,
    dailyRate: dailyRate(project.stars ?? 0, project.createdAt, now),
    createdAt: project.createdAt,
    pushedAt: project.updatedAt,
  }
}

/**
 * 升星榜数据。只有窗口内有两次以上真实快照才会给出增量；
 * 否则 `hasGain=false`，界面必须明确说明原因，而不是编一个数字。
 */
export function buildStarBoard({
  projects,
  history,
  window,
  kind,
  mode,
  now = Date.now(),
}: {
  projects: Project[]
  history: StarSnapshot[]
  window: StarWindow
  kind: RepoKind | 'all'
  mode: StarMode
  now?: number
}): StarBoard {
  const snapshots = normalizeSnapshots(history, now)
  const latest = snapshots[snapshots.length - 1]
  const inWindow = windowSnapshots(snapshots, window)
  const base = inWindow.length >= 2 ? inWindow[0] : null

  const rows = projects
    .filter((project) => project.provenance.source === 'github' && typeof project.stars === 'number')
    .map((project) => {
      const fullName = project.provenance.repoFullName ?? project.slug
      const baseStars = base?.repos[fullName]
      const latestStars = latest?.repos[fullName]
      const gain = base && typeof baseStars === 'number' && typeof latestStars === 'number' ? latestStars - baseStars : null
      return toRow({ ...project, stars: latestStars ?? project.stars }, gain, now)
    })
    .filter((row) => kind === 'all' || row.kind === kind)

  const sorted = rows.sort((a, b) => {
    if (mode === 'gain') {
      const left = a.gain ?? -Infinity
      const right = b.gain ?? -Infinity
      if (left !== right) return right - left
      return b.stars - a.stars
    }
    if (mode === 'rate') return b.dailyRate - a.dailyRate || b.stars - a.stars
    return b.stars - a.stars
  })

  return {
    rows: sorted,
    mode,
    snapshotCount: inWindow.length,
    totalSnapshots: snapshots.length,
    earliest: inWindow[0]?.at,
    latest: latest?.at,
    hasGain: rows.some((row) => row.gain !== null),
  }
}

export function kindCounts(projects: Project[]): { kind: RepoKind; count: number }[] {
  const live = projects.filter((project) => project.provenance.source === 'github')
  const map = new Map<RepoKind, number>()
  for (const project of live) {
    const kind = classifyRepoKind({
      name: project.provenance.repoFullName ?? project.slug,
      description: project.tagline,
      topics: project.tags,
    })
    map.set(kind, (map.get(kind) ?? 0) + 1)
  }
  return KIND_ORDER.map((kind) => ({ kind, count: map.get(kind) ?? 0 })).filter((item) => item.count > 0)
}
