import type { Facets, Filters, ProjectStatus, SortKey } from '../data/types'
import { PROJECT_CATEGORIES, STATUS_META } from '../data/categories'
import { toggleInList } from '../lib/urlState'

interface FilterBarProps {
  facets: Facets
  filters: Filters
  featured: boolean
  activeCount: number
  onChange: (patch: Partial<Filters & { featured: boolean }>) => void
  onReset: () => void
  searchRef?: React.RefObject<HTMLInputElement | null>
}

export function FilterBar({
  facets,
  filters,
  featured,
  activeCount,
  onChange,
  onReset,
  searchRef,
}: FilterBarProps) {
  const selectedCats = filters.categories ?? []
  const selectedStack = filters.stack ?? []
  const selectedStatuses = filters.statuses ?? []
  const topStack = facets.stack.slice(0, 8)

  return (
    <section className="filters" aria-label="筛选展品">
      <div className="filters__row">
        <label className="search">
          <span className="search__icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={searchRef}
            id="hall-search"
            type="search"
            value={filters.query ?? ''}
            placeholder="搜索作品、作者、技术栈…"
            aria-label="搜索作品"
            title="按 / 快速聚焦"
            onChange={(event) => onChange({ query: event.target.value })}
          />
          {(filters.query ?? '') !== '' && (
            <button type="button" className="search__clear" onClick={() => onChange({ query: '' })} aria-label="清空搜索">
              ✕
            </button>
          )}
        </label>
        <button
          type="button"
          className={`toggle ${featured ? 'toggle--on' : ''}`}
          aria-pressed={featured}
          onClick={() => onChange({ featured: !featured })}
        >
          ★ 只看精选
        </button>
        {activeCount > 0 && (
          <button type="button" className="ghost-btn" onClick={onReset}>
            清空筛选（{activeCount}）
          </button>
        )}
      </div>

      <div className="filters__group" role="group" aria-label="按分类筛选">
        {PROJECT_CATEGORIES.map((category) => {
          const count = facets.categories.find((item) => item.id === category.id)?.count ?? 0
          const active = selectedCats.includes(category.id)
          return (
            <button
              key={category.id}
              type="button"
              className={`pill ${active ? 'pill--active' : ''}`}
              aria-pressed={active}
              disabled={count === 0}
              style={{ ['--pill-hue' as string]: category.hue[0] }}
              onClick={() => onChange({ categories: toggleInList(selectedCats, category.id) })}
            >
              <span aria-hidden="true">{category.glyph}</span>
              {category.label}
              <em>{count}</em>
            </button>
          )
        })}
      </div>

      <div className="filters__row filters__row--tight">
        <div className="filters__group" role="group" aria-label="按技术栈筛选">
          <span className="filters__label">技术栈</span>
          {topStack.map((item) => {
            const active = selectedStack.includes(item.name)
            return (
              <button
                key={item.name}
                type="button"
                className={`pill pill--mini ${active ? 'pill--active' : ''}`}
                aria-pressed={active}
                onClick={() => onChange({ stack: toggleInList(selectedStack, item.name) })}
              >
                {item.name}
                <em>{item.count}</em>
              </button>
            )
          })}
        </div>
        <div className="filters__group" role="group" aria-label="按状态筛选">
          <span className="filters__label">状态</span>
          {(Object.keys(STATUS_META) as ProjectStatus[]).map((status) => {
            const active = selectedStatuses.includes(status)
            return (
              <button
                key={status}
                type="button"
                className={`pill pill--mini ${active ? 'pill--active' : ''}`}
                aria-pressed={active}
                onClick={() => onChange({ statuses: toggleInList(selectedStatuses, status) })}
              >
                {STATUS_META[status].label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export const SORT_LABEL: Record<SortKey, string> = {
  trending: '热度',
  newest: '最新',
  oldest: '最早',
  stars: '星标',
  az: '名称',
}
