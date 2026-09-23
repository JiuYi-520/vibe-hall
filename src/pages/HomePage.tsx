import { useMemo, useRef } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Filters, Project } from '../data/types'
import { buildFacets, computeStats, filterProjects, pickFeatured, rankProjects, sortProjects } from '../data/queries'
import { loadProjects } from '../data/loadProjects'
import { activeFilterCount, parseGalleryState, serializeGalleryState, SORT_KEYS, type GalleryState } from '../lib/urlState'
import { usePrefersReducedMotion } from '../lib/hooks'
import { formatCompact } from '../lib/format'
import { FilterBar, SORT_LABEL } from '../components/FilterBar'
import { ProjectCard } from '../components/ProjectCard'
import { Marquee } from '../components/Marquee'
import { useInteractions } from '../lib/interactionBoard'
import { applyLikes } from '../data/interactions'
import { seedComments } from '../data/interactionSeed'

interface HomePageProps {
  projects?: Project[]
  liveCount?: number
  fetchedAt?: string | null
}

const bundle = loadProjects()

export function HomePage({
  projects = bundle.projects,
  liveCount = bundle.liveCount,
  fetchedAt = bundle.fetchedAt ?? null,
}: HomePageProps) {
  const [params, setParams] = useSearchParams()
  const interactionState = useInteractions()
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)
  const reduced = usePrefersReducedMotion()

  const state = useMemo(() => parseGalleryState(params.toString()), [params])
  /** 本机点赞叠加到展品自带热度上，卡片与筛选都用叠加后的数据。 */
  const displayProjects = useMemo(() => applyLikes(projects, interactionState.liked), [projects, interactionState.liked])
  const commentCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const comment of [...seedComments, ...interactionState.comments]) {
      map.set(comment.projectSlug, (map.get(comment.projectSlug) ?? 0) + 1)
    }
    return map
  }, [interactionState.comments])
  const filtered = useMemo(
    () =>
      filterProjects(displayProjects, {
        query: state.q,
        categories: state.cats,
        stack: state.stack,
        statuses: state.statuses,
        onlyFeatured: state.featured,
      }),
    [displayProjects, state],
  )
  // 搜索态先按相关性排序，其余情况按用户选的排序方式。
  const ordered = useMemo(
    () => (state.q ? rankProjects(filtered, state.q, state.sort) : sortProjects(filtered, state.sort)),
    [filtered, state.q, state.sort],
  )
  const facets = useMemo(() => buildFacets(displayProjects), [displayProjects])
  const stats = useMemo(() => computeStats(displayProjects), [displayProjects])
  const featured = useMemo(() => pickFeatured(ordered.filter((project) => project.featured), 4), [ordered])
  const activeCount = activeFilterCount(state)

  /** 用原生 View Transitions 做筛选变化的 FLIP 过渡；不支持时直接更新。 */
  const applyState = (next: GalleryState) => {
    const commit = () => setParams(new URLSearchParams(serializeGalleryState(next)), { replace: true })
    const doc = document as Document & { startViewTransition?: (callback: () => void) => void }
    if (doc.startViewTransition && !reduced) doc.startViewTransition(() => flushSync(commit))
    else commit()
  }

  const update = (patch: Partial<GalleryState>) => applyState({ ...state, ...patch })

  /** FilterBar 用的是领域层的 Filters 字段名，这里翻译成 URL 状态字段。 */
  const applyFilters = (patch: Partial<Filters & { featured: boolean }>) => {
    applyState({
      ...state,
      ...('query' in patch ? { q: patch.query ?? '' } : {}),
      ...('categories' in patch ? { cats: patch.categories ?? [] } : {}),
      ...('stack' in patch ? { stack: patch.stack ?? [] } : {}),
      ...('statuses' in patch ? { statuses: patch.statuses ?? [] } : {}),
      ...('featured' in patch ? { featured: patch.featured ?? false } : {}),
    })
  }

  const reset = () => {
    applyState({ ...state, q: '', cats: [], stack: [], statuses: [], featured: false })
  }

  /**
   * HashRouter 下 href="#hall" 会被当成路由跳转（变成 /hall 兜底页），
   * 所以这里拦下默认行为，改成页内平滑滚动。
   */
  const scrollToHall = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById('hall')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="hall">
      <section className="hero">
        <div className="hero__aura" aria-hidden="true" />
        <div className="hero__inner">
          <h1 className="hero__title enter" style={{ ['--i' as string]: 0 }}>
            用自然语言盖起来的
            <span className="hero__title-accent">一整条街</span>
          </h1>
          <div className="hero__cta enter" data-testid="hero-cta" style={{ ['--i' as string]: 1 }}>
            <a className="btn btn--primary" href="#hall" onClick={scrollToHall}>
              进入展馆 ↓
            </a>
            <Link className="btn btn--ghost" to="/submit">
              提交我的作品
            </Link>
          </div>
          <dl className="hero__stats enter" style={{ ['--i' as string]: 2 }}>
            <div>
              <dt>馆内展品</dt>
              <dd>{stats.projects}</dd>
            </div>
            <div>
              <dt>创作者</dt>
              <dd>{stats.makers}</dd>
            </div>
            <div>
              <dt>累计掌声</dt>
              <dd>{formatCompact(stats.reactions)}</dd>
            </div>
            <div
              title={liveCount > 0 && fetchedAt ? `真实 GitHub 作品抓取于 ${fetchedAt.slice(0, 16).replace('T', ' ')}` : undefined}
            >
              <dt>{liveCount > 0 ? 'GitHub 实时' : '数据来源'}</dt>
              <dd>{liveCount > 0 ? `${liveCount} 件` : '示例'}</dd>
            </div>
          </dl>
          {liveCount === 0 && (
            <p className="hero__notice">
              当前是示例数据。运行 <code>npm run fetch:github</code> 拉取真实作品。
            </p>
          )}
        </div>
        <Marquee projects={sortProjects(filtered, 'newest')} />
      </section>

      <section className="section" id="hall" tabIndex={-1}>
        <div className="section__head">
          <h2>
            <span aria-hidden="true">▤</span> 展馆大厅
          </h2>
        </div>

        <FilterBar
          facets={facets}
          filters={{ query: state.q, categories: state.cats, stack: state.stack, statuses: state.statuses }}
          featured={state.featured}
          activeCount={activeCount}
          onChange={applyFilters}
          onReset={reset}
          searchRef={searchRef}
        />

        <div className="toolbar">
          <p className="toolbar__count" aria-live="polite">
            <strong data-testid="result-count">{ordered.length}</strong>
            <span> / {displayProjects.length} 件展品</span>
            {state.q && <em>· 已按相关性排序</em>}
            {activeCount > 0 && <em>· 已筛选 {activeCount} 项</em>}
          </p>
          <div className="toolbar__controls">
            <div className="segmented" role="group" aria-label="排序方式">
              {SORT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={state.sort === key ? 'is-active' : ''}
                  aria-pressed={state.sort === key}
                  onClick={() => update({ sort: key })}
                >
                  {SORT_LABEL[key]}
                </button>
              ))}
            </div>
            <div className="segmented segmented--icons" role="group" aria-label="布局">
              <button
                type="button"
                aria-label="网格视图"
                aria-pressed={state.view === 'grid'}
                className={state.view === 'grid' ? 'is-active' : ''}
                onClick={() => update({ view: 'grid' })}
              >
                ▦
              </button>
              <button
                type="button"
                aria-label="列表视图"
                aria-pressed={state.view === 'list'}
                className={state.view === 'list' ? 'is-active' : ''}
                onClick={() => update({ view: 'list' })}
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {featured.length > 0 && (
          <div className="featured">
            <h3 className="featured__title">
              <span aria-hidden="true">★</span> 本周精选
            </h3>
            <div className="featured__row">
              {featured.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  highlight={state.q}
                  commentCount={commentCounts.get(project.slug) ?? 0}
                />
              ))}
            </div>
          </div>
        )}

        {ordered.length > 0 ? (
          <div className={`grid grid--${state.view}`}>
            {ordered.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                view={state.view}
                highlight={state.q}
                commentCount={commentCounts.get(project.slug) ?? 0}
              />
            ))}
          </div>
        ) : (
          <div className="empty" data-testid="empty-state">
            <p className="empty__glyph" aria-hidden="true">
              ◌
            </p>
            <h3>这个筛选条件下一件展品都没有</h3>
            <p>换一个关键词，或者先把筛选清空再看整条街。</p>
            <button type="button" className="btn btn--primary" onClick={reset}>
              清空筛选
            </button>
          </div>
        )}
      </section>

      <section className="section section--cta">
        <div className="cta-card">
          <div>
            <h2>你的作品也应该有一扇门</h2>
            <p>挂进来时请附上提示词或迭代记录。</p>
          </div>
          <div className="cta-card__actions">
            <button type="button" className="btn btn--primary" onClick={() => navigate('/submit')}>
              去提交
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/wishes')}>
              我没有作品，但我想许个愿
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
