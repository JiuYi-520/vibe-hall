import type { Project } from './types'
import { seedProjects } from './seed'
import liveProjects from './github-live.json'
import { validateProjects } from './validateProjects'
import { SHOW_DEMO_CONTENT } from './demo'

export interface ProjectBundle {
  projects: Project[]
  /** true when real GitHub records were merged in. */
  hasLive: boolean
  liveCount: number
  fetchedAt?: string | null
  issues: string[]
}

interface LiveFile {
  fetchedAt?: string | null
  query?: string | null
  projects?: Project[]
}

export interface LoadProjectsOptions {
  /** 是否把 src/data/seed.ts 的演示示例补进目录（生产默认关闭）。 */
  includeDemo?: boolean
}

/**
 * Merges the optional GitHub snapshot with the demo catalogue.
 * Invalid live records are dropped instead of being rendered as if they were real.
 */
export function loadProjects({ includeDemo = SHOW_DEMO_CONTENT }: LoadProjectsOptions = {}): ProjectBundle {
  const file = liveProjects as LiveFile
  const raw = Array.isArray(file.projects) ? file.projects : []
  const invalid = validateProjects(raw)
  const invalidIds = new Set(invalid.map((issue) => issue.id))
  const live = raw.filter((project) => !invalidIds.has(project.id))

  const seen = new Set(live.map((project) => project.slug))
  const seeded = includeDemo ? seedProjects.filter((project) => !seen.has(project.slug)) : []

  return {
    projects: [...live, ...seeded],
    hasLive: live.length > 0,
    liveCount: live.length,
    fetchedAt: file.fetchedAt,
    issues: invalid.map((issue) => `${issue.code}:${issue.id}`),
  }
}
