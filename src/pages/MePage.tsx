import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EMPTY_PROFILE, type LocalProfile } from '../data/identity'
import { countMyContributions } from '../data/forum'
import { type IdentityBoard, identityBoard as defaultIdentity, useIdentity } from '../lib/identityStore'
import { type WishBoard, useWishes, wishBoard as defaultWishBoard } from '../lib/wishBoard'
import { type ForumBoard, forumBoard as defaultForumBoard, useForumPosts } from '../lib/forumBoard'
import { type InteractionBoard, interactionBoard as defaultInteractions, useInteractions } from '../lib/interactionBoard'
import { useCopy } from '../lib/hooks'

interface MePageProps {
  identity?: IdentityBoard
  wishes?: WishBoard
  forum?: ForumBoard
  interactions?: InteractionBoard
}

const HUE_CHOICES = [212, 268, 318, 168, 38, 12, 192, 286]

export function MePage({
  identity = defaultIdentity,
  wishes = defaultWishBoard,
  forum = defaultForumBoard,
  interactions = defaultInteractions,
}: MePageProps) {
  const profile = useIdentity(identity)
  const forumPosts = useForumPosts(forum)
  const interactionState = useInteractions(interactions)
  const allWishes = useWishes(wishes)
  const [draft, setDraft] = useState<LocalProfile>(profile ?? EMPTY_PROFILE)
  const [editing, setEditing] = useState(false)
  const [issues, setIssues] = useState<string[]>([])
  const [toast, copy] = useCopy()

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
    }
    void copy(JSON.stringify(payload, null, 2), '本机数据')
  }

  const resetAll = () => {
    identity.clear()
    wishes.reset()
    forum.reset()
    interactions.reset()
    setDraft(EMPTY_PROFILE)
    setEditing(false)
    setIssues([])
  }

  const save = () => {
    const result = identity.save(draft)
    if (!result.ok) {
      setIssues(result.issues.map((issue) => issue.detail))
      return
    }
    setIssues([])
    setEditing(false)
  }

  return (
    <div className="section me">
      <header className="me__head">
        <h1>我的主页</h1>
        <p className="me__lead">
          本机身份不是账号：<strong>没有密码、没有验证、也不会上传</strong>。它只是给愿望、接单和发帖一个署名。
        </p>
      </header>

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
