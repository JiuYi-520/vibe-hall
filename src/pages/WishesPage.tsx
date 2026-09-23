import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CategoryId, Project } from '../data/types'
import type { Wish } from '../data/wishTypes'
import { filterWishes, sortWishes, validateWishDraft } from '../data/wishes'
import { summarize } from '../data/credits'
import { PROJECT_CATEGORIES } from '../data/categories'
import { loadProjects } from '../data/loadProjects'
import { useCopy } from '../lib/hooks'
import { type WishBoard, useWishes, wishBoard as defaultBoard } from '../lib/wishBoard'
import { type IdentityBoard, identityBoard as defaultIdentity, useIdentity } from '../lib/identityStore'
import { type CreditBoard, creditBoard as defaultCredits, useCredits } from '../lib/creditBoard'
import { WishCard } from '../components/WishCard'

interface WishesPageProps {
  board?: WishBoard
  identity?: IdentityBoard
  projects?: Project[]
  credits?: CreditBoard
}

const bundle = loadProjects()


const FAIL_TEXT: Record<string, string> = {
  'missing-maker': '请至少填一个接单人名字或账号',
  'already-claimed': '这条愿望已经有人接单了',
  'already-delivered': '这条愿望已经交付了',
  'not-claimed': '这条愿望还没有人接单',
  'not-claimant': '只有接单人本人可以把愿望标记为已交付',
  'missing-delivery': '请先选一件关联作品',
  'not-found': '没有找到这条愿望',
}

export function WishesPage({
  board = defaultBoard,
  identity = defaultIdentity,
  projects = bundle.projects,
  credits = defaultCredits,
}: WishesPageProps) {
  const wishes = useWishes(board)
  const profile = useIdentity(identity)
  const creditState = useCredits(credits)
  const [params] = useSearchParams()
  /** 从命令面板跳进来时高亮并滚到那一条。 */
  const focus = params.get('focus')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    title: '',
    brief: '',
    wisherName: profile?.nickname ?? '',
    wisherHandle: profile?.handle ?? '',
    category: 'life' as CategoryId,
    tags: '',
    bountyAmount: '',
    bountyNote: '',
  }))
  const [issues, setIssues] = useState<string[]>([])
  const [toast, copy] = useCopy()

  const filtered = useMemo(
    () => sortWishes(filterWishes(wishes, { query }), 'open-first'),
    [wishes, query],
  )
  const localCount = board.getState().patch.created.length

  useEffect(() => {
    if (!focus) return
    document.getElementById(`wish-${focus}`)?.scrollIntoView({ block: 'center' })
  }, [focus, wishes.length])

  /** 本机身份可能是后设置的：只补空字段，不覆盖用户已经输入的内容。 */
  useEffect(() => {
    setDraft((current) => ({
      ...current,
      wisherName: current.wisherName || profile?.nickname || '',
      wisherHandle: current.wisherHandle || profile?.handle || '',
    }))
  }, [profile])

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
    credits.earn('wish', draft.title)
    setDraft({
      title: '',
      brief: '',
      wisherName: profile?.nickname ?? '',
      wisherHandle: profile?.handle ?? '',
      category: draft.category,
      tags: '',
      bountyAmount: '',
      bountyNote: '',
    })
    setFormOpen(false)
    setQuery('')
  }

  const claim = (id: string, maker: { name: string; handle: string }, note: string) => {
    const result = board.claim(id, maker, note)
    if (result.ok) credits.earn('claim', result.wish.title)
    return result.ok ? null : (FAIL_TEXT[result.reason] ?? '接单失败')
  }

  const deliver = (id: string, delivery: { projectSlug?: string; note?: string }) => {
    const wish = wishes.find((item) => item.id === id)
    const actor = wish?.claim?.maker.handle ?? ''
    const result = board.deliver(id, actor, delivery)
    if (result.ok) credits.earn('deliver', result.wish.title)
    return result.ok ? null : (FAIL_TEXT[result.reason] ?? '交付失败')
  }

  return (
    <div className="section wishes">
      <div className="wishes__search">
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
      </div>

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
            <label>
              <span>意向悬赏（元，可留空）</span>
              <input
                value={draft.bountyAmount}
                inputMode="numeric"
                onChange={(event) => setDraft({ ...draft, bountyAmount: event.target.value })}
                placeholder="例如 300"
              />
            </label>
            <label>
              <span>悬赏说明（可选）</span>
              <input value={draft.bountyNote} onChange={(event) => setDraft({ ...draft, bountyNote: event.target.value })} placeholder="做好了请喝咖啡" />
            </label>
          </div>
          <p className="wishes__money">
            悬赏只是<strong>意向表示</strong>：展馆不收款、不支付、不托管，也不参与任何结算。
          </p>
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

      {filtered.length > 0 ? (
        <ul className="wishes__list" data-testid="wish-list">
          {filtered.map((wish: Wish) => (
            <WishCard
              key={wish.id}
              wish={wish}
              projects={projects}
              onToggleCheer={(id) => board.toggleCheer(id)}
              cheered={Boolean(board.getState().patch.cheered?.[wish.id])}
              onClaim={claim}
              onDeliver={deliver}
              me={profile}
              focused={focus === wish.slug}
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
            }}
          >
            清空筛选
          </button>
        </div>
      )}

      <p className="wishes__bar" aria-live="polite">
        <strong data-testid="wish-count">{filtered.length}</strong>
        <span>/ {wishes.length} 条愿望 · 单机版，只有本机能看见</span>
        <span>· 积分 {summarize(creditState.entries).balance}</span>
        <button type="button" className="link-btn" onClick={() => setFormOpen((open) => !open)}>
          贴一个新愿望
        </button>
        <button type="button" className="link-btn" onClick={() => copy(board.exportJson(), '愿望 JSON')}>
          导出 JSON
        </button>
        {localCount > 0 && (
          <button type="button" className="link-btn" onClick={() => board.reset()}>
            清空本机改动（{localCount}）
          </button>
        )}
      </p>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
