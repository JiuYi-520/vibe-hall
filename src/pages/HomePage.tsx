import { useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Filters, Project } from '../data/types'
import { buildFacets, computeStats, filterProjects, sortProjects } from '../data/queries'
import { loadProjects } from '../data/loadProjects'
import { activeFilterCount, parseGalleryState, serializeGalleryState, type GalleryState } from '../lib/urlState'
import { usePalette } from '../lib/paletteContext'
import { formatCompact } from '../lib/format'
import { FilterBar, SORT_LABEL } from '../components/FilterBar'
import { ProjectCard } from '../components/ProjectCard'
import { Marquee } from '../components/Marquee'
import { SORT_KEYS } from '../lib/urlState'

interface HomePageProps {
  projects?: Project[]
  liveCount?: number
  fetchedAt?: string | null
}

const bundle = loadProjects()

export function HomePage({ projects = bundle.projects, liveCount = bundle.liveCount, fetchedAt = bundle.fetchedAt ?? null }: HomePageProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const palette = usePalette()
  const searchRef = useRef<HTMLInputElement>(null)

  const state = useMemo(() => parseGalleryState(params.toString()), [params])
  const filtered = useMemo(
    () =>
      filterProjects(projects, {
        query: state.q,
        categories: state.cats,
        stack: state.stack,
        statuses: state.statuses,
        onlyFeatured: state.featured,
      }),
    [projects, state],
  )
  const sorted = useMemo(() => sortProjects(filtered, state.sort), [filtered, state.sort])
  const facets = useMemo(() => buildFacets(projects), [projects])
  const stats = useMemo(() => computeStats(projects), [projects])
  const featured = useMemo(() => sorted.filter((project) => project.featured), [sorted])
  const activeCount = activeFilterCount(state)

  const applyState = (next: GalleryState) => setParams(new URLSearchParams(serializeGalleryState(next)), { replace: true })

  const update = (patch: Partial<GalleryState>) => applyState({ ...state, ...patch })

  /** FilterBar speaks the domain Filters vocabulary; translate it into url state keys. */
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
    setParams(new URLSearchParams(serializeGalleryState({ ...state, q: '', cats: [], stack: [], statuses: [], featured: false })), {
      replace: true,
    })
  }

  return (
    <div className="hall">
      <section className="hero">
        <div className="hero__aura" aria-hidden="true" />
        <div className="hero__inner">
          <motion.p
            className="hero__eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            一人一扇门 · {stats.makers} 位创作者 · {stats.stacks} 种技术栈
          </motion.p>
          <motion.h1
            className="hero__title"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            用自然语言盖起来的
            <span className="hero__title-accent">一整条街</span>
          </motion.h1>
          <motion.p
            className="hero__lead"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
          >
            这里陈列不同创作者的 vibecoding 作品：它们是游戏、课件、看板、玩具，也是别人某天晚上
            “我就想试试能不能做出来”的结果。点开任意一扇门，能看到那件作品是怎么被说出来的。
          </motion.p>
          <motion.div
            className="hero__cta"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
          >
            <a className="btn btn--primary" href="#hall">
              进入展馆 ↓
            </a>
            <button type="button" className="btn btn--ghost" onClick={palette.open}>
              ⌘K 快速跳转
            </button>
            <Link className="btn btn--ghost" to="/submit">
              提交我的作品
            </Link>
          </motion.div>
          <dl className="hero__stats">
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
            <div>
              <dt>{liveCount > 0 ? 'GitHub 实时' : '数据来源'}</dt>
              <dd>{liveCount > 0 ? `${liveCount} 件` : '示例'}</dd>
            </div>
          </dl>
          {liveCount === 0 && (
            <p className="hero__notice">
              当前是内置示例数据（不含真实作者作品）。运行 <code>npm run fetch:github</code> 会拉取真实
              GitHub 作品并自动替换为“GitHub 实时”来源。
            </p>
          )}
          {liveCount > 0 && fetchedAt && (
            <p className="hero__notice hero__notice--ok">
              已合并 {liveCount} 件真实 GitHub 作品{fetchedAt ? `，抓取于 ${fetchedAt.slice(0, 16).replace('T', ' ')}` : ''}。
            </p>
          )}
        </div>
        <Marquee projects={sortProjects(filtered, 'newest')} />
      </section>

      <section className="section" id="hall">
        <div className="section__head">
          <h2>
            <span aria-hidden="true">▤</span> 展馆大厅
          </h2>
          <p className="section__hint">筛选、排序、键盘导航都可用；筛选状态会写进链接，可直接分享。</p>
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
            <strong data-testid="result-count">{sorted.length}</strong>
            <span> / {projects.length} 件展品</span>
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
              {featured.slice(0, 4).map((project, index) => (
                <ProjectCard key={project.id} project={project} index={index} view="grid" />
              ))}
            </div>
          </div>
        )}

        {sorted.length > 0 ? (
          <motion.div layout className={`grid grid--${state.view}`}>
            {sorted.map((project, index) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              >
                <ProjectCard project={project} index={index} view={state.view} />
              </motion.div>
            ))}
          </motion.div>
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
            <p>
              不限语言、不限体量：一个能跑的网页玩具、一块看板、一个课堂演示，都可以挂进这条街。
              提交时请附上你的提示词或迭代记录——那是这个展馆最想看的部分。
            </p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/submit')}>
            去提交
          </button>
        </div>
      </section>
    </div>
  )
}
