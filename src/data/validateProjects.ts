import type { CategoryId, Project } from './types'
import { CATEGORY_IDS } from './categories'

export { PROJECT_CATEGORIES, CATEGORY_IDS, CATEGORY_LABEL, STATUS_META, categoryMeta } from './categories'

export type IssueCode = 'duplicate-slug' | 'empty-field' | 'unknown-category' | 'unsafe-link'

export interface ProjectIssue {
  code: IssueCode
  id: string
  detail: string
}

const REQUIRED_TEXT: (keyof Project)[] = ['id', 'slug', 'title', 'tagline', 'story', 'createdAt']

const SAFE_LINK = /^(https?:\/\/|mailto:|[./#])/i

export function validateProjects(projects: Project[]): ProjectIssue[] {
  const issues: ProjectIssue[] = []
  const seen = new Map<string, number>()

  for (const project of projects) {
    const previous = seen.get(project.slug)
    if (previous !== undefined) {
      issues.push({ code: 'duplicate-slug', id: project.id, detail: `slug "${project.slug}" already used` })
    }
    seen.set(project.slug, (seen.get(project.slug) ?? 0) + 1)

    for (const field of REQUIRED_TEXT) {
      const raw = project[field]
      if (typeof raw !== 'string' || raw.trim() === '') {
        issues.push({ code: 'empty-field', id: project.id, detail: `${String(field)} is empty` })
      }
    }

    if (!project.maker?.name?.trim() || !project.maker?.handle?.trim()) {
      issues.push({ code: 'empty-field', id: project.id, detail: 'maker name/handle is empty' })
    }

    if (project.stack.length === 0) {
      issues.push({ code: 'empty-field', id: project.id, detail: 'stack is empty' })
    }

    if (project.links.length === 0) {
      issues.push({ code: 'empty-field', id: project.id, detail: 'links is empty' })
    }

    if (!CATEGORY_IDS.includes(project.category as CategoryId)) {
      issues.push({ code: 'unknown-category', id: project.id, detail: `category "${project.category}" is unknown` })
    }

    for (const link of project.links) {
      if (!SAFE_LINK.test(link.url.trim())) {
        issues.push({ code: 'unsafe-link', id: project.id, detail: `link "${link.url}" is not an http(s) or relative url` })
      }
    }
  }

  return issues
}
