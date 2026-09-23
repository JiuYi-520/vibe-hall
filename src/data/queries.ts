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
