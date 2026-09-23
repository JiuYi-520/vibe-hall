import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ForumAuthor, PostKind } from '../data/forumTypes'
import { FORUM_SORT_LABEL, POST_KIND_META, POST_KIND_ORDER } from '../data/forum'
import { countMyContributions, filterPosts, forumStats, sortPosts, validateForumDraft } from '../data/forum'
import { type ForumBoard, forumBoard as defaultBoard, useForumPosts } from '../lib/forumBoard'
import { type IdentityBoard, identityBoard as defaultIdentity, useIdentity } from '../lib/identityStore'
import { toggleInList } from '../lib/urlState'
import { useCopy } from '../lib/hooks'
import { PostCard } from '../components/PostCard'

interface ForumPageProps {
  board?: ForumBoard
  identity?: IdentityBoard
}

const SORTS = ['newest', 'active', 'likes'] as const

const FAIL_TEXT: Record<string, string> = {
  'missing-author': '请先设置本机身份',
  'empty-reply': '回复至少写两个字',
  'not-found': '没有找到这条帖子',
}

export function ForumPage({ board = defaultBoard, identity = defaultIdentity }: ForumPageProps) {
  const posts = useForumPosts(board)
  const profile = useIdentity(identity)
  const [params] = useSearchParams()
  /** 从命令面板跳进来时高亮并滚到那一条。 */
  const focus = params.get('focus')
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<PostKind[]>([])
  const [sort, setSort] = useState<(typeof SORTS)[number]>('newest')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', body: '', kind: 'ask' as PostKind })
  const [issues, setIssues] = useState<string[]>([])
  const [toast, copy] = useCopy()

  const me: ForumAuthor | null = profile
    ? { nickname: profile.nickname, handle: profile.handle, hue: profile.hue }
    : null

  const filtered = useMemo(
    () => sortPosts(filterPosts(posts, { query, kinds }), sort),
    [posts, query, kinds, sort],
  )
  const stats = forumStats(posts)
  const mine = profile ? countMyContributions(posts, profile.handle, profile.nickname) : { posts: 0, replies: 0 }
  const localCount = board.getState().patch.created.length

  useEffect(() => {
    if (!focus) return
    document.getElementById(`post-${focus}`)?.scrollIntoView({ block: 'center' })
  }, [focus, posts.length])

  const submit = () => {
    if (!me) {
      setIssues(['请先设置本机身份'])
      return
    }
    const found = validateForumDraft({ ...draft, author: me })
    if (found.length > 0) {
      setIssues(found.map((issue) => issue.detail))
      return
    }
    const result = board.createPost({ ...draft, author: me })
    if (!result.ok) {
      setIssues(result.issues.map((issue) => issue.detail))
      return
    }
    setIssues([])
    setDraft({ title: '', body: '', kind: draft.kind })
    setFormOpen(false)
    setQuery('')
    setKinds([])
  }

  const reply = (id: string, body: string) => {
    if (!me) return FAIL_TEXT['missing-author']
    const result = board.reply(id, me, body)
    return result.ok ? null : (FAIL_TEXT[result.reason] ?? '回复失败')
  }

  return (
    <div className="section forum">
      <header className="forum__head">
        <h1>论坛</h1>
        <p className="forum__lead">聊接单、聊坑、聊刚做出来的东西。</p>
        <p className="forum__notice">
          <strong>单机版</strong>：帖子和回复只保存在本机浏览器里，别人看不到；导出 JSON 可交给维护者收录。
        </p>
      </header>

      <dl className="forum__stats" data-testid="forum-stats">
        <div>
          <dt>帖子</dt>
          <dd>{stats.posts}</dd>
        </div>
        <div>
          <dt>回复</dt>
          <dd>{stats.replies}</dd>
        </div>
        <div>
          <dt>作者</dt>
          <dd>{stats.authors}</dd>
        </div>
        <div>
          <dt>今日新帖</dt>
          <dd>{stats.today}</dd>
        </div>
      </dl>

      <div className="forum__actions">
        <button type="button" className="btn btn--primary" onClick={() => setFormOpen((open) => !open)}>
          ✎ 发新帖
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => copy(board.exportJson(), '论坛 JSON')}>
          导出 JSON
        </button>
        {localCount > 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => board.reset()}>
            清空本机改动（{localCount}）
          </button>
        )}
        <Link className="btn btn--ghost" to="/me">
          {me ? `我的主页 · ${mine.posts} 帖 ${mine.replies} 回复` : '设置本机身份'}
        </Link>
      </div>

      {formOpen && (
        <form
          className="forum__form"
          data-testid="post-form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          {me ? (
            <p className="forum__as">
              以 <strong>{me.nickname}</strong>
              {me.handle && <em>@{me.handle}</em>} 发布
            </p>
          ) : (
            <p className="forum__as forum__as--warn">
              先设置本机身份才能发帖 · <Link to="/me">去设置</Link>
            </p>
          )}
          <div className="forum__form-row">
            <label>
              <span>标题</span>
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="一句话说清要聊什么" />
            </label>
            <label>
              <span>分类</span>
              <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as PostKind })}>
                {POST_KIND_ORDER.map((kind) => (
                  <option key={kind} value={kind}>
                    {POST_KIND_META[kind].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>正文</span>
            <textarea rows={4} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="背景、你试过什么、想听什么建议" />
          </label>
          {issues.length > 0 && (
            <ul className="forum__issues" role="alert">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          <div className="forum__form-actions">
            <button type="submit" className="btn btn--primary" disabled={!me}>
              发布
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setFormOpen(false)}>
              取消
            </button>
          </div>
        </form>
      )}

      <section className="filters" aria-label="筛选帖子">
        <div className="filters__row">
          <label className="search">
            <span className="search__icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="search"
              value={query}
              aria-label="搜索帖子"
              placeholder="搜索标题、正文、作者…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="segmented" role="group" aria-label="排序方式">
            {SORTS.map((key) => (
              <button key={key} type="button" className={sort === key ? 'is-active' : ''} aria-pressed={sort === key} onClick={() => setSort(key)}>
                {FORUM_SORT_LABEL[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="filters__group" role="group" aria-label="按分类筛选">
          {POST_KIND_ORDER.map((kind) => {
            const active = kinds.includes(kind)
            const count = posts.filter((post) => post.kind === kind).length
            return (
              <button
                key={kind}
                type="button"
                className={`pill pill--mini ${active ? 'pill--active' : ''}`}
                aria-pressed={active}
                onClick={() => setKinds(toggleInList(kinds, kind))}
              >
                {POST_KIND_META[kind].label}
                <em>{count}</em>
              </button>
            )
          })}
        </div>
      </section>

      <p className="forum__count" aria-live="polite">
        <strong data-testid="forum-count">{filtered.length}</strong>
        <span> / {posts.length} 条帖子</span>
      </p>

      {filtered.length > 0 ? (
        <ul className="forum__list">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} me={me} focused={focus === post.slug} onLike={(id) => board.like(id)} onReply={reply} />
          ))}
        </ul>
      ) : (
        <div className="empty" data-testid="forum-empty">
          <p className="empty__glyph" aria-hidden="true">
            ◌
          </p>
          <h3>没有匹配的帖子</h3>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setQuery('')
              setKinds([])
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
