import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Project } from '../data/types'
import type { Wish } from '../data/wishTypes'
import { WISH_STATUS_META } from '../data/wishes'
import { categoryMeta } from '../data/categories'
import { formatDate } from '../lib/format'

interface WishCardProps {
  wish: Wish
  projects: Project[]
  onCheer: (id: string) => void
  onClaim: (id: string, maker: { name: string; handle: string }, note: string) => string | null
  onDeliver: (id: string, delivery: { projectSlug?: string; note?: string }) => string | null
}

/**
 * 一张愿望卡：贴愿望的人、想要的人数、接单与交付都在这张卡里完成。
 * 接单/交付表单就地展开，避免跳页面丢掉上下文。
 */
export function WishCard({ wish, projects, onCheer, onClaim, onDeliver }: WishCardProps) {
  const [claimOpen, setClaimOpen] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [makerName, setMakerName] = useState('')
  const [makerHandle, setMakerHandle] = useState('')
  const [plan, setPlan] = useState('')
  const [projectSlug, setProjectSlug] = useState(projects[0]?.slug ?? '')
  const [deliverNote, setDeliverNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const meta = categoryMeta(wish.category)
  const status = WISH_STATUS_META[wish.status]
  const isLocal = wish.provenance.source === 'local'
  const deliveredProject = wish.delivered?.projectSlug
    ? projects.find((project) => project.slug === wish.delivered?.projectSlug)
    : undefined

  const submitClaim = () => {
    const failure = onClaim(wish.id, { name: makerName, handle: makerHandle }, plan)
    if (failure) {
      setError(failure)
      return
    }
    setError(null)
    setClaimOpen(false)
  }

  const submitDeliver = () => {
    const failure = onDeliver(wish.id, { projectSlug, note: deliverNote })
    if (failure) {
      setError(failure)
      return
    }
    setError(null)
    setDeliverOpen(false)
  }

  return (
    <li className="wish" data-testid={`wish-card-${wish.slug}`} style={{ ['--hue-a' as string]: meta.hue[0], ['--hue-b' as string]: meta.hue[1] }}>
      <div className="wish__head">
        <span className={`chip chip--${status.tone}`}>{status.label}</span>
        <span className="chip chip--ghost">
          {meta.glyph} {meta.label}
        </span>
        <span className={`chip chip--${isLocal ? 'live' : 'seed'}`}>{isLocal ? '本机' : '示例'}</span>
      </div>

      <h3 className="wish__title">{wish.title}</h3>
      <p className="wish__brief">{wish.brief}</p>

      {wish.tags.length > 0 && (
        <ul className="wish__tags" aria-label="标签">
          {wish.tags.map((tag) => (
            <li key={tag}>#{tag}</li>
          ))}
        </ul>
      )}

      <div className="wish__foot">
        <span className="wish__wisher">
          {wish.wisher.name || '匿名'}
          {wish.wisher.handle && <em>@{wish.wisher.handle}</em>}
          <time dateTime={wish.createdAt}>{formatDate(wish.createdAt)}</time>
        </span>
        <span className="wish__cheers" data-testid={`wish-cheers-${wish.slug}`}>
          <strong>{wish.cheers}</strong> 人想要
          <button type="button" className="ghost-btn" onClick={() => onCheer(wish.id)}>
            我也想要
          </button>
        </span>
      </div>

      {wish.status === 'claimed' && wish.claim && (
        <div className="wish__claim">
          <p>
            <strong>接单人</strong> {wish.claim.maker.name || '匿名'} <em>@{wish.claim.maker.handle}</em>
            <time dateTime={wish.claim.claimedAt}>{wish.claim.claimedAt}</time>
          </p>
          {wish.claim.note && <p className="wish__note">计划：{wish.claim.note}</p>}
          {!deliverOpen && (
            <button type="button" className="btn btn--ghost" onClick={() => setDeliverOpen(true)}>
              标记为已交付
            </button>
          )}
        </div>
      )}

      {wish.status === 'delivered' && wish.delivered && (
        <div className="wish__delivered">
          <p>
            <strong>已交付</strong>
            <time dateTime={wish.delivered.at}>{wish.delivered.at}</time>
            {wish.delivered.note && <span className="wish__note"> · {wish.delivered.note}</span>}
          </p>
          {deliveredProject ? (
            <Link className="btn btn--primary" to={`/p/${deliveredProject.slug}`}>
              看作品：{deliveredProject.title} ↗
            </Link>
          ) : wish.delivered.url ? (
            <a className="btn btn--primary" href={wish.delivered.url} target="_blank" rel="noreferrer noopener">
              看作品 ↗
            </a>
          ) : null}
        </div>
      )}

      {wish.status === 'open' && !claimOpen && (
        <button type="button" className="btn btn--primary wish__take" onClick={() => setClaimOpen(true)}>
          我来接单
        </button>
      )}

      {claimOpen && (
        <form
          className="wish__form"
          onSubmit={(event) => {
            event.preventDefault()
            submitClaim()
          }}
        >
          <div className="wish__form-row">
            <label>
              <span>接单人名字</span>
              <input value={makerName} onChange={(event) => setMakerName(event.target.value)} placeholder="你的名字" />
            </label>
            <label>
              <span>接单人账号</span>
              <input value={makerHandle} onChange={(event) => setMakerHandle(event.target.value)} placeholder="github 用户名" />
            </label>
          </div>
          <label>
            <span>一句话计划</span>
            <input value={plan} onChange={(event) => setPlan(event.target.value)} placeholder="打算先做什么" />
          </label>
          <div className="wish__form-actions">
            <button type="submit" className="btn btn--primary">
              确认接单
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setClaimOpen(false)}>
              取消
            </button>
          </div>
        </form>
      )}

      {deliverOpen && (
        <form
          className="wish__form"
          onSubmit={(event) => {
            event.preventDefault()
            submitDeliver()
          }}
        >
          <label>
            <span>关联作品</span>
            <select value={projectSlug} onChange={(event) => setProjectSlug(event.target.value)}>
              {projects.map((project) => (
                <option key={project.slug} value={project.slug}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>交付说明</span>
            <input value={deliverNote} onChange={(event) => setDeliverNote(event.target.value)} placeholder="做完了什么，还差什么" />
          </label>
          <div className="wish__form-actions">
            <button type="submit" className="btn btn--primary">
              确认交付
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setDeliverOpen(false)}>
              取消
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="wish__error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}
