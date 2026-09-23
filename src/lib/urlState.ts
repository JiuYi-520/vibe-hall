import { CATEGORY_IDS } from '../data/categories'
import type { CategoryId, ProjectStatus, SortKey } from '../data/types'

export type GalleryView = 'grid' | 'list'

export interface GalleryState {
  q: string
  cats: CategoryId[]
  stack: string[]
  statuses: ProjectStatus[]
  sort: SortKey
  view: GalleryView
  featured: boolean
}

export const SORT_KEYS: SortKey[] = ['trending', 'newest', 'oldest', 'stars', 'az']
export const STATUS_KEYS: ProjectStatus[] = ['live', 'wip', 'archived']

export const DEFAULT_GALLERY_STATE: GalleryState = {
  q: '',
  cats: [],
  stack: [],
  statuses: [],
  sort: 'trending',
  // 一个案例占一行：默认用单行列表版式，想密集看可以切回网格
  view: 'list',
  featured: false,
}

export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function list<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return [...new Set(values)].filter((item): item is T => (allowed as readonly string[]).includes(item))
}

/** Reads gallery state from a URL query string; unknown values are dropped, never trusted. */
export function parseGalleryState(search: string): GalleryState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const sort = params.get('sort') as SortKey | null
  const view = params.get('view')

  return {
    q: params.get('q') ?? '',
    cats: list(params.get('cats'), CATEGORY_IDS),
    stack: params.get('stack')
      ? params
          .get('stack')!
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    statuses: list(params.get('status'), STATUS_KEYS),
    sort: sort && SORT_KEYS.includes(sort) ? sort : DEFAULT_GALLERY_STATE.sort,
    view: view === 'list' || view === 'grid' ? view : DEFAULT_GALLERY_STATE.view,
    featured: params.get('featured') === '1',
  }
}

/** Serialises only the values that differ from the defaults, so shareable urls stay short. */
export function serializeGalleryState(state: GalleryState): string {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.cats.length) params.set('cats', state.cats.join(','))
  if (state.stack.length) params.set('stack', state.stack.join(','))
  if (state.statuses.length) params.set('status', state.statuses.join(','))
  if (state.sort !== DEFAULT_GALLERY_STATE.sort) params.set('sort', state.sort)
  if (state.view !== DEFAULT_GALLERY_STATE.view) params.set('view', state.view)
  if (state.featured) params.set('featured', '1')
  params.sort()
  return params.toString()
}

export function activeFilterCount(state: GalleryState): number {
  return (
    (state.q ? 1 : 0) +
    state.cats.length +
    state.stack.length +
    state.statuses.length +
    (state.featured ? 1 : 0)
  )
}
