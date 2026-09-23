import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CategoryId, Project } from '../data/types'
import type { Wish, WishSortKey, WishStatus } from '../data/wishTypes'
import { WISH_SORT_LABEL, WISH_STATUS_META, WISH_STATUS_ORDER } from '../data/wishTypes'
import { filterWishes, sortWishes, validateWishDraft, wishCategories, wishStats } from '../data/wishes'
import { PROJECT_CATEGORIES } from '../data/categories'
import { loadProjects } from '../data/loadProjects'
import { toggleInList } from '../lib/urlState'
import { useCopy } from '../lib/hooks'
import { type WishBoard, useWishes, wishBoard as defaultBoard } from '../lib/wishBoard'
import { WishCard } from '../components/WishCard'

interface WishesPageProps {
  board?: WishBoard
  projects?: Project[]
}

const bundle = loadProjects()

const SORT_ORDER: WishSortKey[] = ['open-first', 'newest', 'cheers']

const FAIL_TEXT: Record<string, string> = {
  'missing-maker': '请至少填一个接单人名字或账号',
  'already-claimed': '这条愿望已经有人接单了',
  'already-delivered': '这条愿望已经交付了',
  'not-claimed': '这条愿望还没有人接单',
  'not-claimant': '只有接单人本人可以把愿望标记为已交付',
  'missing-delivery': '请先选一件关联作品',
  'not-found': '没有找到这条愿望',
}

export function WishesPage({ board = defaultBoard, projects = bundle.projects }: WishesPageProps) {
  const wishes = useWishes(board)
  const [query, setQuery] = useState('')
  const [statuses, setStatuses] = useState<WishStatus[]>([])
  const [cats, setCats] = useState<CategoryId[]>([])
  const [sort, setSort] = useState<WishSortKey>('open-first')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState({
    title: '',
    brief: '',
    wisherName: '',
    wisherHandle: '',
    category: 'life' as CategoryId,
    tags: '',
  })
  const [issues, setIssues] = useState<string[]>([])
  const [toast, copy] = useCopy()

  const filtered = useMemo(
    () => sortWishes(filterWishes(wishes, { query, statuses, categories: cats }), sort),
    [wishes, query, statuses, cats, sort],
  )
  const stats = wishStats(wishes)
  const facets = useMemo(() => wishCategories(wishes), [wishes])
  const localCount = board.getState().patch.created.length

  const submitDraft = () => {
    const found = validateWishDraft(draft)
    if (found.length > 0) {
      setIssues(found.map((issue) => issue.detail))
      return
    }
    const result = board.createWish(draft)
    if (!result.ok) {
      setIssues(result.issues.map((issue) => issue.detail))
      return
    }
    setIssues([])
    setDraft({ title: '', brief: '', wisherName: '', wisherHandle: '', category: draft.category, tags: '' })
    setFormOpen(false)
    setQuery('')
    setStatuses([])
    setCats([])
  }

  const claim = (id: string, maker: { name: string; handle: string }, note: string) => {
    const result = board.claim(id, maker, note)
    return result.ok ? null : (FAIL_TEXT[result.reason] ?? '接单失败')
  }

  const deliver = (id: string, delivery: { projectSlug?: string; note?: string }) => {
    const wish = wishes.find((item) => item.id === id)
    const actor = wish?.claim?.maker.handle ?? ''
    const result = board.deliver(id, actor, delivery)
    return result.ok ? null : (FAIL_TEXT[result.reason] ?? '交付失败')
  }

  return (
    <div className="section wishes">
      <header className="wishes__head">
        <p className="wishes__eyebrow enter" style={{ ['--i' as string]: 0 }}>
          愿望墙 · {stats.total} 条愿望 · {stats.open} 条还等着人接
        </p>
        <h1 className="enter" style={{ ['--i' as string]: 1 }}>
          说清你想要什么，等人接单
        </h1>
        <p className="wishes__lead enter" style={{ ['--i' as string]: 2 }}>
          这里贴的不是成品，是需求本身：给谁用、解决什么、长什么样。有人觉得这事值得做，就会按下「我来接单」；
          做出来之后把作品挂回大厅，这条愿望就变成「已交付」。
        </p>
        <div className="wishes__actions enter" style={{ ['--i' as string]: 3 }}>
          <button type="button" className="btn btn--primary" onClick={() => setFormOpen((open) => !open)}>
            ✎ 贴一个新愿望
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => copy(board.exportJson(), '愿望 JSON')}>
            导出 JSON
          </button>
          {localCount > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => board.reset()}>
              清空本机改动（{localCount}）
            </button>
          )}
          <Link className="btn btn--ghost" to="/">
            回展馆
          </Link>
        </div>
        <p className="wishes__notice">
          没有后端：你贴的愿望和接单记录只保存在<strong>这台浏览器的本机存储</strong>里，别人看不到；刷新不丢，
          「导出 JSON」可以把它们交给展馆维护者正式收录。
        </p>
      </header>

      <dl className="wishes__stats" data-testid="wish-stats">
        <div>
          <dt>待接单</dt>
          <dd data-testid="wish-stat-open">{stats.open}</dd>
        </div>
        <div>
          <dt>已接单</dt>
          <dd data-testid="wish-stat-claimed">{stats.claimed}</dd>
        </div>
        <div>
          <dt>已交付</dt>
          <dd data-testid="wish-stat-delivered">{stats.delivered}</dd>
        </div>
        <div>
          <dt>全部愿望</dt>
          <dd data-testid="wish-stat-total">{stats.total}</dd>
        </div>
      </dl>

      {formOpen && (
        <form
          className="wishes__form"
          data-testid="wish-form"
          onSubmit={(event) => {
            event.preventDefault()
            submitDraft()
          }}
        >
          <div className="wishes__form-row">
            <label>
              <span>愿望标题</span>
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="想要一个…的东西" />
            </label>
            <label>
              <span>分类</span>
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as CategoryId })}>
                {PROJECT_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>愿望描述</span>
            <textarea
              rows={3}
              value={draft.brief}
              onChange={(event) => setDraft({ ...draft, brief: event.target.value })}
              placeholder="给谁用、解决什么问题、你希望它长什么样"
            />
          </label>
          <div className="wishes__form-row">
            <label>
              <span>署名</span>
              <input value={draft.wisherName} onChange={(event) => setDraft({ ...draft, wisherName: event.target.value })} placeholder="你的名字" />
            </label>
            <label>
              <span>账号</span>
              <input value={draft.wisherHandle} onChange={(event) => setDraft({ ...draft, wisherHandle: event.target.value })} placeholder="github 用户名" />
            </label>
            <label>
              <span>标签</span>
              <input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="逗号分隔" />
            </label>
          </div>
          {issues.length > 0 && (
            <ul className="wishes__issues" role="alert">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          <div className="wishes__form-actions">
            <button type="submit" className="btn btn--primary">
              贴到愿望墙
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setFormOpen(false)}>
              取消
            </button>
          </div>
        </form>
      )}

      <section className="filters" aria-label="筛选愿望">
        <div className="filters__row">
          <label className="search">
            <span className="search__icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="search"
              value={query}
              aria-label="搜索愿望"
              placeholder="搜索愿望、标签或许愿人…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="segmented" role="group" aria-label="排序方式">
            {SORT_ORDER.map((key) => (
              <button key={key} type="button" className={sort === key ? 'is-active' : ''} aria-pressed={sort === key} onClick={() => setSort(key)}>
                {WISH_SORT_LABEL[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="filters__group" role="group" aria-label="按状态筛选">
          {WISH_STATUS_ORDER.map((status) => {
            const active = statuses.includes(status)
            const count = wishes.filter((wish) => wish.status === status).length
            return (
              <button
                key={status}
                type="button"
                className={`pill ${active ? 'pill--active' : ''}`}
                aria-pressed={active}
                style={{ ['--pill-hue' as string]: status === 'open' ? 38 : status === 'claimed' ? 154 : 230 }}
                onClick={() => setStatuses(toggleInList(statuses, status))}
              >
                {WISH_STATUS_META[status].label}
                <em>{count}</em>
              </button>
            )
          })}
        </div>
        <div className="filters__group" role="group" aria-label="按分类筛选">
          <span className="filters__label">分类</span>
          {facets.map((facet) => {
            const active = cats.includes(facet.id)
            const meta = PROJECT_CATEGORIES.find((category) => category.id === facet.id)
            return (
              <button
                key={facet.id}
                type="button"
                className={`pill pill--mini ${active ? 'pill--active' : ''}`}
                aria-pressed={active}
                style={{ ['--pill-hue' as string]: meta?.hue[0] ?? 212 }}
                onClick={() => setCats(toggleInList(cats, facet.id))}
              >
                {meta?.label ?? facet.id}
                <em>{facet.count}</em>
              </button>
            )
          })}
        </div>
      </section>

      <p className="wishes__count" aria-live="polite">
        <strong data-testid="wish-count">{filtered.length}</strong>
        <span> / {wishes.length} 条愿望</span>
      </p>

      {filtered.length > 0 ? (
        <ul className="wishes__list" data-testid="wish-list">
          {filtered.map((wish: Wish) => (
            <WishCard
              key={wish.id}
              wish={wish}
              projects={projects}
              onCheer={(id) => board.cheer(id)}
              onClaim={claim}
              onDeliver={deliver}
            />
          ))}
        </ul>
      ) : (
        <div className="empty" data-testid="wish-empty">
          <p className="empty__glyph" aria-hidden="true">
            ◌
          </p>
          <h3>这个筛选条件下没有愿望</h3>
          <p>换个关键词，或者自己贴一条。</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setQuery('')
              setStatuses([])
              setCats([])
            }}
          >
            清空筛选
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
