import type { Facets, Filters, HallStats, Project, SortKey } from './types'
import { CATEGORY_LABEL } from './categories'

const MS_PER_DAY = 86_400_000
const MAX_RECENCY_DAYS = 400

export function trendingScore(project: Project): number {
  const ageDays = (Date.now() - new Date(project.createdAt).getTime()) / MS_PER_DAY
  const recency = Number.isFinite(ageDays) ? Math.max(0, MAX_RECENCY_DAYS - ageDays) * 1.5 : 0
  const featured = project.featured ? 60 : 0
  return project.likes * 2 + (project.stars ?? 0) * 0.5 + recency + featured
}

function searchableText(project: Project): string {
  return [
    project.title,
    project.tagline,
    project.story,
    project.prompt ?? '',
    project.maker.name,
    project.maker.handle,
    CATEGORY_LABEL[project.category] ?? '',
    ...project.tags,
    ...project.stack,
  ]
    .join(' ')
    .toLowerCase()
}

export function matchesQuery(project: Project, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = searchableText(project)
  return terms.every((term) => haystack.includes(term))
}

export function filterProjects(projects: Project[], filters: Filters): Project[] {
  const { query = '', categories, stack, statuses, onlyFeatured } = filters
  return projects.filter((project) => {
    if (!matchesQuery(project, query)) return false
    if (categories?.length && !categories.includes(project.category)) return false
    if (statuses?.length && !statuses.includes(project.status)) return false
    if (onlyFeatured && !project.featured) return false
    if (stack?.length && !stack.every((name) => project.stack.includes(name))) return false
    return true
  })
}

export function sortProjects(projects: Project[], sort: SortKey): Project[] {
  const copy = [...projects]
  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => time(b.createdAt) - time(a.createdAt) || a.title.localeCompare(b.title))
    case 'oldest':
      return copy.sort((a, b) => time(a.createdAt) - time(b.createdAt) || a.title.localeCompare(b.title))
    case 'stars':
      return copy.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1))
    case 'az':
      return copy.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
    case 'trending':
    default:
      return copy.sort((a, b) => trendingScore(b) - trendingScore(a))
  }
}

function time(iso: string): number {
  const value = new Date(iso).getTime()
  return Number.isNaN(value) ? 0 : value
}

function rank<T extends { count: number }>(items: T[], key: (item: T) => string): T[] {
  return items.sort((a, b) => b.count - a.count || key(a).localeCompare(key(b)))
}

export function buildFacets(projects: Project[]): Facets {
  const categories = new Map<string, number>()
  const stack = new Map<string, number>()
  const tags = new Map<string, number>()

  for (const project of projects) {
    categories.set(project.category, (categories.get(project.category) ?? 0) + 1)
    for (const name of project.stack) stack.set(name, (stack.get(name) ?? 0) + 1)
    for (const tag of project.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1)
  }

  return {
    categories: rank(
      [...categories].map(([id, count]) => ({ id: id as Project['category'], count })),
      (item) => item.id,
    ),
    stack: rank(
      [...stack].map(([name, count]) => ({ name, count })),
      (item) => item.name,
    ),
    tags: rank(
      [...tags].map(([name, count]) => ({ name, count })),
      (item) => item.name,
    ),
  }
}

export function computeStats(projects: Project[]): HallStats {
  const makers = new Set<string>()
  const stacks = new Set<string>()
  let reactions = 0

  for (const project of projects) {
    makers.add(project.maker.handle || project.maker.name)
    for (const name of project.stack) stacks.add(name)
    reactions += project.likes
  }

  return { projects: projects.length, makers: makers.size, stacks: stacks.size, reactions }
}

export function pickRelated(projects: Project[], current: Project, limit = 3): Project[] {
  return projects
    .filter((project) => project.slug !== current.slug)
    .map((project) => {
      const sharedStack = project.stack.filter((name) => current.stack.includes(name)).length
      const sharedTags = project.tags.filter((tag) => current.tags.includes(tag)).length
      const sameCategory = project.category === current.category ? 2 : 0
      return { project, score: sharedStack * 2 + sharedTags + sameCategory }
    })
    .sort((a, b) => b.score - a.score || trendingScore(b.project) - trendingScore(a.project))
    .slice(0, limit)
    .map((entry) => entry.project)
}

/** 拆分查询词：空格、中英文逗号与顿号都算分隔。 */
export function queryTerms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/[\s,，、]+/)
    .filter(Boolean)
}

const FIELD_WEIGHT = { title: 12, titlePrefix: 4, tagline: 6, tags: 5, stack: 4, maker: 3, story: 1 }

/**
 * 相关性打分：标题命中 > 标签/技术栈/作者 > 简介 > 故事。
 * 命中位置越靠前分数越高，保证“搜索时先给最像的结果”。
 */
export function relevanceScore(project: Project, query: string): number {
  const terms = queryTerms(query)
  if (terms.length === 0) return 0

  const title = project.title.toLowerCase()
  const tagline = project.tagline.toLowerCase()
  const tags = project.tags.join(' ').toLowerCase()
  const stack = project.stack.join(' ').toLowerCase()
  const maker = `${project.maker.name} ${project.maker.handle}`.toLowerCase()
  const story = `${project.story} ${project.prompt ?? ''}`.toLowerCase()

  let score = 0
  for (const term of terms) {
    if (title.includes(term)) score += FIELD_WEIGHT.title + (title.startsWith(term) ? FIELD_WEIGHT.titlePrefix : 0)
    if (tagline.includes(term)) score += FIELD_WEIGHT.tagline
    if (tags.includes(term)) score += FIELD_WEIGHT.tags
    if (stack.includes(term)) score += FIELD_WEIGHT.stack
    if (maker.includes(term)) score += FIELD_WEIGHT.maker
    if (story.includes(term)) score += FIELD_WEIGHT.story
  }
  return score
}

/** 搜索态排序：先按相关性，再按用户选择的排序（JS sort 稳定，天然成为并列次序）。 */
export function rankProjects(projects: Project[], query: string, tieBreak: SortKey = 'trending'): Project[] {
  if (queryTerms(query).length === 0) return [...projects]
  return sortProjects(projects, tieBreak).sort((a, b) => relevanceScore(b, query) - relevanceScore(a, query))
}

/** 精选位：先每个分类各占一席，再按热度补齐，避免同类霸榜。 */
export function pickFeatured(projects: Project[], limit = 4): Project[] {
  const ranked = sortProjects(projects, 'trending')
  const picked: Project[] = []
  const usedCategories = new Set<string>()

  for (const project of ranked) {
    if (picked.length >= limit) break
    if (usedCategories.has(project.category)) continue
    usedCategories.add(project.category)
    picked.push(project)
  }
  for (const project of ranked) {
    if (picked.length >= limit) break
    if (picked.includes(project)) continue
    picked.push(project)
  }
  return sortProjects(picked, 'trending')
}
