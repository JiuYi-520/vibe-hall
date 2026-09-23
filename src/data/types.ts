/** Domain model for a single vibe-coding work shown in the hall. */

export type CategoryId =
  | 'tool'
  | 'game'
  | 'education'
  | 'visual'
  | 'data'
  | 'ai'
  | 'life'
  | 'sound'

export type ProjectStatus = 'live' | 'wip' | 'archived'

export type LinkKind = 'demo' | 'repo' | 'video' | 'article' | 'prompt'

export interface ProjectLink {
  kind: LinkKind
  label: string
  url: string
}

export interface Maker {
  name: string
  handle: string
  avatarUrl?: string
  url?: string
  bio?: string
}

/** Where this record came from. Kept in the model so the UI never fakes provenance. */
export interface Provenance {
  source: 'seed' | 'github'
  fetchedAt?: string
  query?: string
  repoFullName?: string
  htmlUrl?: string
  note?: string
}

export interface Project {
  id: string
  slug: string
  title: string
  /** 真实作品封面图（GitHub 记录由仓库名派生，见 data/cover.ts）。 */
  coverImageUrl?: string
  /** One line hook shown on the card. */
  tagline: string
  /** Longer first-person story: how it was prompted, what broke, what changed. */
  story: string
  /** The prompt or prompt chain that produced the first working version. */
  prompt?: string
  category: CategoryId
  tags: string[]
  stack: string[]
  maker: Maker
  links: ProjectLink[]
  createdAt: string
  updatedAt?: string
  likes: number
  stars?: number
  featured: boolean
  status: ProjectStatus
  /** Optional iteration log, newest last. */
  iterations?: { version: string; note: string }[]
  provenance: Provenance
}

export interface Facets {
  categories: { id: CategoryId; count: number }[]
  stack: { name: string; count: number }[]
  tags: { name: string; count: number }[]
}

export interface Filters {
  query?: string
  categories?: CategoryId[]
  stack?: string[]
  statuses?: ProjectStatus[]
  onlyFeatured?: boolean
}

export type SortKey = 'trending' | 'newest' | 'oldest' | 'stars' | 'az'

export interface HallStats {
  projects: number
  makers: number
  stacks: number
  reactions: number
}
