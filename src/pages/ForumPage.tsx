import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ForumAuthor, ForumPost, PostKind } from '../data/forumTypes'
import { FORUM_SORT_LABEL, POST_KIND_META, POST_KIND_ORDER } from '../data/forum'
import { countMyContributions, filterPosts, forumStats, sortPosts, validateForumDraft } from '../data/forum'
import { summarize } from '../data/credits'
import { type ForumBoard, forumBoard as defaultBoard, useForumPosts } from '../lib/forumBoard'
import { type IdentityBoard, identityBoard as defaultIdentity, useIdentity } from '../lib/identityStore'
import { type CreditBoard, creditBoard as defaultCredits, useCredits } from '../lib/creditBoard'
import { toggleInList } from '../lib/urlState'
import { useCopy } from '../lib/hooks'
import { PostCard } from '../components/PostCard'
import { ensureServerToken, getServerToken, serverApi, toPost, useHallServer } from '../lib/hallServer'

interface ForumPageProps {
  board?: ForumBoard
  identity?: IdentityBoard
  credits?: CreditBoard
}

const SORTS = ['newest', 'active', 'likes'] as const

const FAIL_TEXT: Record<string, string> = {
  'missing-author': '请先设置本机身份',
  'empty-reply': '回复至少写两个字',
  'not-found': '没有找到这条帖子',
}

export function ForumPage({ board = defaultBoard, identity = defaultIdentity, credits = defaultCredits }: ForumPageProps) {
  const posts = useForumPosts(board)
  const profile = useIdentity(identity)
  const creditState = useCredits(credits)
  const server = useHallServer()
  const [remotePosts, setRemotePosts] = useState<ForumPost[] | null>(null)
  const [serverToken, setServerToken] = useState(getServerToken())
  const online = server.status === 'online'
  const activePosts: ForumPost[] = online && remotePosts ? remotePosts : posts

  const refreshRemote = useCallback(async () => {
    const result = await serverApi.listPosts(serverToken || undefined)
    if (result.ok && result.data) setRemotePosts(result.data.posts.map(toPost))
  }, [serverToken])

  useEffect(() => {
    if (!online) {
      setRemotePosts(null)
      return
    }
    void refreshRemote()
  }, [online, refreshRemote])

  const requireToken = useCallback(async () => {
    if (serverToken) return serverToken
    const fresh = await ensureServerToken(profile ?? { nickname: '访客', handle: '' })
    if (fresh) setServerToken(fresh)
    return fresh
  }, [profile, serverToken])
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
    () => sortPosts(filterPosts(activePosts, { query, kinds }), sort),
    [activePosts, query, kinds, sort],
  )
  const stats = forumStats(activePosts)
  const mine = profile ? countMyContributions(activePosts, profile.handle, profile.nickname) : { posts: 0, replies: 0 }
  const localCount = board.getState().patch.created.length

  useEffect(() => {
    if (!focus) return
    document.getElementById(`post-${focus}`)?.scrollIntoView({ block: 'center' })
  }, [focus, posts.length])

  const submit = async () => {
    if (!me) {
      setIssues(['请先设置本机身份'])
      return
    }
    const found = validateForumDraft({ ...draft, author: me })
    if (found.length > 0) {
      setIssues(found.map((issue) => issue.detail))
      return
    }
    if (online) {
      const token = await requireToken()
      if (!token) {
        setIssues(['后端在线但拿不到设备令牌，暂时无法发帖'])
        return
      }
      const posted = await serverApi.createPost(token, { title: draft.title, body: draft.body, kind: draft.kind })
      if (!posted.ok) {
        setIssues([`后端写入失败：${posted.error}（没有保存，请稍后再试）`])
        return
      }
      await refreshRemote()
    } else {
      const result = board.createPost({ ...draft, author: me })
      if (!result.ok) {
        setIssues(result.issues.map((issue) => issue.detail))
        return
      }
    }
    setIssues([])
    credits.earn('post', draft.title)
    setDraft({ title: '', body: '', kind: draft.kind })
    setFormOpen(false)
    setQuery('')
    setKinds([])
  }

  const reply = async (id: string, body: string) => {
    if (!me) return FAIL_TEXT['missing-author']
    if (online) {
      const token = await requireToken()
      if (!token) return '后端在线但拿不到设备令牌'
      const result = await serverApi.replyPost(token, id, body)
      if (!result.ok) return `后端拒绝：${result.error}`
      await refreshRemote()
      credits.earn('reply', result.data?.post.title ?? '帖子')
      return null
    }
    const result = board.reply(id, me, body)
    if (result.ok) credits.earn('reply', result.post.title)
    return result.ok ? null : (FAIL_TEXT[result.reason] ?? '回复失败')
  }

  /** 在线时点赞也走服务端，离线才落本机。 */
  const toggleLike = async (id: string) => {
    if (!online) {
      board.toggleLike(id)
      return
    }
    const token = await requireToken()
    if (!token) return
    const result = await serverApi.likePost(token, id)
    if (!result.ok) return
    await refreshRemote()
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
          {me
            ? `我的主页 · ${mine.posts} 帖 ${mine.replies} 回复 · 积分 ${summarize(creditState.entries).balance}`
            : '设置本机身份'}
        </Link>
      </div>

      {formOpen && (
        <form
          className="forum__form"
          data-testid="post-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
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
            <PostCard
              key={post.id}
              post={post}
              me={me}
              focused={focus === post.slug}
              liked={post.liked ?? board.isLiked(post.id)}
              onToggleLike={(id) => void toggleLike(id)}
              onReply={reply}
            />
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
