import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { EMPTY_PROFILE, type LocalProfile } from '../data/identity'
import { countMyContributions } from '../data/forum'
import { type IdentityBoard, identityBoard as defaultIdentity, useIdentity } from '../lib/identityStore'
import { type WishBoard, useWishes, wishBoard as defaultWishBoard } from '../lib/wishBoard'
import { type ForumBoard, forumBoard as defaultForumBoard, useForumPosts } from '../lib/forumBoard'
import { type InteractionBoard, interactionBoard as defaultInteractions, useInteractions } from '../lib/interactionBoard'
import { type CreditBoard, creditBoard as defaultCredits, useCredits } from '../lib/creditBoard'
import { BADGES, CREDIT_RULES, CREDITS_DISCLAIMER, summarize } from '../data/credits'
import { useCopy } from '../lib/hooks'
import { authStore, useAuth } from '../lib/authStore'

interface MePageProps {
  identity?: IdentityBoard
  wishes?: WishBoard
  forum?: ForumBoard
  interactions?: InteractionBoard
  credits?: CreditBoard
}

const HUE_CHOICES = [212, 268, 318, 168, 38, 12, 192, 286]

export function MePage({
  identity = defaultIdentity,
  wishes = defaultWishBoard,
  forum = defaultForumBoard,
  interactions = defaultInteractions,
  credits = defaultCredits,
}: MePageProps) {
  const profile = useIdentity(identity)
  const auth = useAuth()
  const forumPosts = useForumPosts(forum)
  const interactionState = useInteractions(interactions)
  const creditState = useCredits(credits)
  const creditSummary = summarize(creditState.entries)
  const allWishes = useWishes(wishes)
  const [draft, setDraft] = useState<LocalProfile>(profile ?? EMPTY_PROFILE)
  const [editing, setEditing] = useState(false)
  const [issues, setIssues] = useState<string[]>([])
  const [toast, copy] = useCopy()
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authDraft, setAuthDraft] = useState({ handle: '', password: '', nickname: '', bio: '' })
  const [authIssues, setAuthIssues] = useState<string[]>([])
  const [authBusy, setAuthBusy] = useState(false)

  const showForm = !profile || editing
  /** 账号或昵称任一匹配即算「我的」——只填昵称的人也要有统计。 */
  const same = (left?: string, right?: string) =>
    Boolean(left?.trim()) && Boolean(right?.trim()) && left!.trim().replace(/^@/, '').toLowerCase() === right!.trim().replace(/^@/, '').toLowerCase()
  const isMine = (handle?: string, name?: string) => same(handle, profile?.handle) || same(name, profile?.nickname)

  const myWishes = profile ? allWishes.filter((wish) => isMine(wish.wisher.handle, wish.wisher.name)) : []
  const claims = profile ? Object.values(wishes.getState().patch.claims) : []
  const myClaims = profile ? claims.filter((claim) => isMine(claim.maker.handle, claim.maker.name)) : []
  const mine = profile ? countMyContributions(forumPosts, profile.handle, profile.nickname) : { posts: 0, replies: 0 }

  const exportLocal = () => {
    const payload = {
      schema: 'vibe-hall.local-export.v1',
      exportedAt: new Date().toISOString(),
      identity: profile,
      wishes: JSON.parse(wishes.exportJson()),
      forum: JSON.parse(forum.exportJson()),
      interactions: JSON.parse(interactions.exportJson()),
      credits: JSON.parse(credits.exportJson()),
    }
    void copy(JSON.stringify(payload, null, 2), '本机数据')
  }

  const resetAll = () => {
    identity.clear()
    wishes.reset()
    forum.reset()
    interactions.reset()
    credits.reset()
    setDraft(EMPTY_PROFILE)
    setEditing(false)
    setIssues([])
  }

  const save = async () => {
    if (auth.status === 'authenticated') {
      const remote = await authStore.updateProfile({ nickname: draft.nickname, handle: draft.handle, bio: draft.bio, hue: draft.hue })
      if (!remote.ok) {
        setIssues([remote.error ?? '服务器资料保存失败'])
        return
      }
    }
    const result = identity.save(draft)
    if (!result.ok) {
      setIssues(result.issues.map((issue) => issue.detail))
      return
    }
    setIssues([])
    setEditing(false)
  }

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthBusy(true)
    setAuthIssues([])
    const result =
      authMode === 'login'
        ? await authStore.login({ handle: authDraft.handle, password: authDraft.password })
        : await authStore.register({ handle: authDraft.handle, password: authDraft.password, nickname: authDraft.nickname, bio: authDraft.bio })
    setAuthBusy(false)
    if (!result.ok) setAuthIssues([result.error ?? (authMode === 'login' ? '登录失败' : '注册失败')])
    else setAuthDraft((current) => ({ ...current, password: '' }))
  }

  return (
    <div className="section me">
      <header className="me__head">
        <h1>我的主页</h1>
        {auth.user ? (
          <p className="me__lead">
            这是你的自建账号资料。昵称、账号、简介和头像色会同步到服务器；本机数据仍可单独导出。
          </p>
        ) : (
          <p className="me__lead">
            本机身份不是账号：<strong>没有密码、没有验证、也不会上传</strong>。登录后可把它升级为跨设备账号。
          </p>
        )}
      </header>

      <section className="me__account" data-testid="account-section">
        <div className="me__account-head">
          <div>
            <h2>账号与个人信息</h2>
            <p>登录后昵称、账号、简介和头像色会保存在服务器，可在不同设备继续使用。</p>
          </div>
          {auth.status === 'authenticated' && auth.user && (
            <button type="button" className="btn btn--ghost" onClick={() => void authStore.logout()}>
              退出登录
            </button>
          )}
        </div>
        {auth.status === 'authenticated' && auth.user ? (
          <p className="me__account-status" data-testid="account-status">
            已登录 <strong>@{auth.user.handle}</strong> · 资料已同步
          </p>
        ) : (
          <>
            <div className="segmented me__auth-tabs" aria-label="登录方式">
              <button
                type="button"
                aria-label="显示登录表单"
                aria-pressed={authMode === 'login'}
                className={authMode === 'login' ? 'is-active' : ''}
                onClick={() => setAuthMode('login')}
              >
                登录
              </button>
              <button
                type="button"
                aria-label="显示注册表单"
                aria-pressed={authMode === 'register'}
                className={authMode === 'register' ? 'is-active' : ''}
                onClick={() => setAuthMode('register')}
              >
                注册账号
              </button>
            </div>
            <form className="me__auth-form" onSubmit={submitAuth}>
              {authMode === 'register' && (
                <label>
                  <span>注册昵称</span>
                  <input
                    value={authDraft.nickname}
                    onChange={(event) => setAuthDraft({ ...authDraft, nickname: event.target.value })}
                    autoComplete="name"
                    placeholder="别人看到的名字"
                  />
                </label>
              )}
              <label>
                <span>{authMode === 'login' ? '登录账号' : '注册账号'}</span>
                <input
                  value={authDraft.handle}
                  onChange={(event) => setAuthDraft({ ...authDraft, handle: event.target.value })}
                  autoComplete="username"
                  placeholder="字母、数字、点、下划线或短横线"
                />
              </label>
              <label>
                <span>密码</span>
                <input
                  type="password"
                  value={authDraft.password}
                  onChange={(event) => setAuthDraft({ ...authDraft, password: event.target.value })}
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="至少 10 个字符"
                />
              </label>
              {authMode === 'register' && (
                <label>
                  <span>注册简介</span>
                  <input value={authDraft.bio} onChange={(event) => setAuthDraft({ ...authDraft, bio: event.target.value })} placeholder="你在做什么" />
                </label>
              )}
              {authIssues.length > 0 && (
                <ul className="me__issues" role="alert">
                  {authIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              )}
              <button type="submit" className="btn btn--primary" disabled={authBusy}>
                {authBusy ? '处理中…' : authMode === 'login' ? '登录' : '创建账号'}
              </button>
            </form>
            {auth.status === 'error' && <p className="me__account-status me__account-status--warn">{auth.error}</p>}
          </>
        )}
      </section>

      {!showForm && profile && (
        <>
          <section className="me__card">
            <span className="me__avatar" aria-hidden="true" style={{ ['--hue-a' as string]: profile.hue }}>
              {(profile.nickname || '匿').slice(0, 1)}
            </span>
            <div className="me__id">
              <strong data-testid="me-nickname">{profile.nickname}</strong>
              <span data-testid="me-handle">{profile.handle ? `@${profile.handle}` : '（没填账号）'}</span>
              {profile.bio && <p>{profile.bio}</p>}
            </div>
            <div className="me__card-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setDraft(profile)
                  setEditing(true)
                }}
              >
                编辑身份
              </button>
            </div>
          </section>

          <dl className="me__stats">
            <div>
              <dt>我的愿望</dt>
              <dd data-testid="me-wishes">{myWishes.length}</dd>
            </div>
            <div>
              <dt>我接的单</dt>
              <dd data-testid="me-claims">{myClaims.length}</dd>
            </div>
            <div>
              <dt>我的帖子</dt>
              <dd data-testid="me-posts">{mine.posts}</dd>
            </div>
            <div>
              <dt>我的回复</dt>
              <dd data-testid="me-replies">{mine.replies}</dd>
            </div>
            <div>
              <dt>我点过赞</dt>
              <dd data-testid="me-likes">{Object.values(interactionState.liked).filter(Boolean).length}</dd>
            </div>
            <div>
              <dt>我写的评论</dt>
              <dd data-testid="me-comments">{interactionState.comments.length}</dd>
            </div>
          </dl>
        </>
      )}

      {showForm && (
        <form
          className="me__form"
          data-testid="me-form"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div className="me__form-row">
            <label>
              <span>昵称</span>
              <input value={draft.nickname} onChange={(event) => setDraft({ ...draft, nickname: event.target.value })} placeholder="别人看到的名字" />
            </label>
            <label>
              <span>账号</span>
              <input value={draft.handle} onChange={(event) => setDraft({ ...draft, handle: event.target.value })} placeholder="github 用户名（可留空）" />
            </label>
          </div>
          <label>
            <span>一句话简介</span>
            <input value={draft.bio ?? ''} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} placeholder="你在做什么" />
          </label>
          <fieldset className="me__hues">
            <legend>头像色</legend>
            {HUE_CHOICES.map((hue) => (
              <button
                key={hue}
                type="button"
                className={`me__hue ${draft.hue === hue ? 'is-active' : ''}`}
                style={{ ['--hue-a' as string]: hue }}
                aria-label={`头像色 ${hue}`}
                aria-pressed={draft.hue === hue}
                onClick={() => setDraft({ ...draft, hue })}
              />
            ))}
          </fieldset>
          {issues.length > 0 && (
            <ul className="me__issues" role="alert">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          <div className="me__form-actions">
            <button type="submit" className="btn btn--primary">
              保存身份
            </button>
            {profile && (
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
                取消
              </button>
            )}
          </div>
        </form>
      )}

      <section className="credits" data-testid="credit-section">
        <h2>积分</h2>
        <dl className="credits__stats">
          <div>
            <dt>余额</dt>
            <dd data-testid="credit-balance">{creditSummary.balance}</dd>
          </div>
          <div>
            <dt>今日</dt>
            <dd>{creditSummary.today >= 0 ? `+${creditSummary.today}` : creditSummary.today}</dd>
          </div>
          <div>
            <dt>累计获得</dt>
            <dd>{creditSummary.earned}</dd>
          </div>
          <div>
            <dt>累计花费</dt>
            <dd>{creditSummary.spent}</dd>
          </div>
        </dl>
        <p className="credits__note">{CREDITS_DISCLAIMER}</p>
        <div className="credits__actions">
          <button type="button" className="link-btn" onClick={() => copy(credits.exportJson(), '积分流水')}>
            导出流水
          </button>
        </div>

        <h3 className="credits__sub">徽章商店</h3>
        <ul className="badges">
          {BADGES.map((badge) => {
            const owned = creditState.owned.includes(badge.id)
            const affordable = creditSummary.balance >= badge.cost
            return (
              <li key={badge.id} className="badge" data-testid={`badge-${badge.id}`} style={{ ['--hue-a' as string]: badge.hue }}>
                <strong>{badge.name}</strong>
                <em>{badge.note}</em>
                <span className="badge__cost">{badge.cost} 积分</span>
                {owned ? (
                  <span className="badges__owned">已拥有</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={!affordable}
                    onClick={() => credits.purchase(badge.id)}
                  >
                    {affordable ? `兑换（${badge.cost}）` : '积分不够'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        <h3 className="credits__sub">流水</h3>
        <ul className="ledger">
          {[...creditState.entries].reverse().slice(0, 10).map((entry) => (
            <li key={entry.id} data-testid={`credit-entry-${entry.id}`}>
              <span>{CREDIT_RULES[entry.reason].label}</span>
              <em>{entry.note}</em>
              <strong>{entry.amount >= 0 ? `+${entry.amount}` : entry.amount}</strong>
              <time dateTime={entry.at}>{entry.at}</time>
            </li>
          ))}
        </ul>
      </section>

      <section className="me__data">
        <h2>本机数据</h2>
        <p>你的身份、愿望、接单与帖子都存在这台浏览器里；导出后可交给维护者正式收录。</p>
        <div className="me__data-actions">
          <button type="button" className="btn btn--ghost" onClick={exportLocal}>
            导出本机数据 JSON
          </button>
          <button type="button" className="btn btn--ghost" onClick={resetAll}>
            清空本机数据
          </button>
          <Link className="btn btn--ghost" to="/wishes">
            去愿望墙
          </Link>
          <Link className="btn btn--ghost" to="/forum">
            去论坛
          </Link>
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
