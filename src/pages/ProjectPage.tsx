import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Project } from '../data/types'
import { loadProjects } from '../data/loadProjects'
import { categoryMeta, STATUS_META } from '../data/categories'
import { pickRelated } from '../data/queries'
import { formatCompact, formatDate, readingTime } from '../lib/format'
import { useCopy, useScrollProgress } from '../lib/hooks'
import { type IdentityBoard, identityBoard as defaultIdentity, useIdentity } from '../lib/identityStore'
import { type InteractionBoard, interactionBoard as defaultInteractions, useInteractions } from '../lib/interactionBoard'
import { type CreditBoard, creditBoard as defaultCredits, useCredits } from '../lib/creditBoard'
import { canDeleteComment, listComments } from '../data/interactions'
import { CREDIT_RULES, summarize } from '../data/credits'
import { seedComments } from '../data/interactionSeed'
import { withDemo } from '../data/demo'
import { ProjectCover } from '../components/ProjectCover'
import { ProjectCard } from '../components/ProjectCard'
import { RepoTrend } from '../components/RepoTrend'
import { starHistory } from '../data/history'

const LINK_LABEL: Record<string, string> = {
  demo: '打开作品',
  repo: '查看源码',
  video: '看演示',
  article: '读记录',
  prompt: '看提示词',
}

interface ProjectPageProps {
  projects?: Project[]
  interactions?: InteractionBoard
  identity?: IdentityBoard
  credits?: CreditBoard
}

const bundle = loadProjects()

export function ProjectPage({
  projects = bundle.projects,
  interactions = defaultInteractions,
  identity = defaultIdentity,
  credits = defaultCredits,
}: ProjectPageProps) {
  const { slug } = useParams()
  const project = projects.find((item) => item.slug === slug)
  const progress = useScrollProgress()
  const [toast, copy] = useCopy()
  const related = useMemo(() => (project ? pickRelated(projects, project, 3) : []), [projects, project])
  const profile = useIdentity(identity)
  const interactionState = useInteractions(interactions)
  const creditState = useCredits(credits)
  const [commentBody, setCommentBody] = useState('')
  const [commentIssues, setCommentIssues] = useState<string[]>([])

  const liked = Boolean(slug && interactionState.liked[slug])
  const comments = project
    ? listComments(withDemo(seedComments), interactionState.comments, project.slug)
    : []
  const likes = project ? project.likes + (liked ? 1 : 0) : 0

  const submitComment = () => {
    if (!project || !profile) return
    const result = interactions.addComment(
      project.slug,
      { name: profile.nickname, handle: profile.handle, hue: profile.hue },
      commentBody,
    )
    if (!result.ok) {
      setCommentIssues(result.issues.map((issue) => issue.detail))
      return
    }
    setCommentIssues([])
    credits.earn('comment', project.title)
    setCommentBody('')
  }

  if (!project) {
    return (
      <div className="section">
        <div className="empty">
          <p className="empty__glyph" aria-hidden="true">
            ◌
          </p>
          <h3>没有这扇门</h3>
          <p>链接可能已经改变，或者这件作品被移出了展馆。</p>
          <Link className="btn btn--primary" to="/">
            回到展馆
          </Link>
        </div>
      </div>
    )
  }

  const meta = categoryMeta(project.category)
  const status = STATUS_META[project.status]
  const isLive = project.provenance.source === 'github'

  return (
    <article className="detail" style={{ ['--hue-a' as string]: meta.hue[0], ['--hue-b' as string]: meta.hue[1] }}>
      <div className="detail__progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      <nav className="detail__crumbs" aria-label="面包屑">
        <Link to="/">展馆</Link>
        <span aria-hidden="true">/</span>
        <span>{meta.label}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{project.title}</span>
      </nav>

      <header className="detail__head">
        <div className="detail__visual enter" style={{ ['--i' as string]: 0 }}>
          <ProjectCover project={project} variant="hero" />
        </div>
        <div className="detail__intro enter" style={{ ['--i' as string]: 1 }}>
          <div className="detail__chips">
            <span className="chip chip--ghost">
              {meta.glyph} {meta.label}
            </span>
            <span className={`chip chip--${status.tone}`}>{status.label}</span>
            <span className={`chip chip--${isLive ? 'live' : 'seed'}`}>{isLive ? 'GitHub 实时' : '示例数据'}</span>
          </div>
          <h1>{project.title}</h1>
          <p className="detail__tagline">{project.tagline}</p>
          <div className="detail__actions">
            <button
              type="button"
              className={`btn ${liked ? 'btn--primary' : 'btn--ghost'}`}
              aria-pressed={liked}
              title={liked ? '再点一次取消' : '点一下表示喜欢'}
              onClick={() => project && interactions.toggleLike(project.slug)}
            >
              {liked ? '已赞 👍' : '点赞 👍'}
              <span data-testid="detail-likes">{likes}</span>
            </button>
            {project.links.map((link) => (
              <a
                key={link.url}
                className={`btn ${link.kind === 'demo' ? 'btn--primary' : 'btn--ghost'}`}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {link.label || LINK_LABEL[link.kind] || '打开链接'} ↗
              </a>
            ))}
          </div>
          <dl className="detail__meta">
            <div>
              <dt>创作者</dt>
              <dd>
                {project.maker.name} <em>@{project.maker.handle}</em>
              </dd>
            </div>
            <div>
              <dt>入馆时间</dt>
              <dd>
                <time dateTime={project.createdAt}>{formatDate(project.createdAt)}</time>
                {project.updatedAt && <em> · 最近更新 {project.updatedAt}</em>}
              </dd>
            </div>
            <div>
              <dt>技术栈</dt>
              <dd>{project.stack.join(' · ')}</dd>
            </div>
            <div>
              <dt>热度</dt>
              <dd>
                {project.likes > 0 ? `👏 ${formatCompact(project.likes)}` : ''}
                {project.likes > 0 && typeof project.stars === 'number' ? ' · ' : ''}
                {typeof project.stars === 'number' && project.stars > 0 ? `★ ${formatCompact(project.stars)}` : ''}
                {project.likes === 0 && !project.stars ? '—' : ''}
              </dd>
            </div>
            <div>
              <dt>来源</dt>
              <dd>
                {project.provenance.source === 'github'
                  ? `GitHub${project.provenance.repoFullName ? ` · ${project.provenance.repoFullName}` : ''}`
                  : '展馆示例数据'}
              </dd>
            </div>
            <div>
              <dt>阅读时长</dt>
              <dd>{readingTime(`${project.story} ${project.prompt ?? ''}`)} 分钟</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="detail__grid">
        {project.provenance.source === 'github' && project.provenance.repoFullName && (
          <RepoTrend repo={project.provenance.repoFullName} history={starHistory} window="30d" />
        )}
        <section className="detail__block">
          <h2>
            <span aria-hidden="true">✎</span> 这是怎么做出来的
          </h2>
          <p className="detail__story">{project.story}</p>
          {project.tags.length > 0 && (
            <ul className="detail__tags" aria-label="标签">
              {project.tags.map((tag) => (
                <li key={tag}>#{tag}</li>
              ))}
            </ul>
          )}
        </section>

        <aside className="detail__aside">
          {project.prompt && (
            <section className="prompt">
              <div className="prompt__head">
                <h2>
                  <span aria-hidden="true">❯</span> 关键提示词
                </h2>
                <button type="button" className="ghost-btn" onClick={() => copy(project.prompt ?? '', '提示词')}>
                  复制
                </button>
              </div>
              <pre className="prompt__body">{project.prompt}</pre>
            </section>
          )}

          {project.iterations && project.iterations.length > 0 && (
            <section className="timeline">
              <h2>
                <span aria-hidden="true">↻</span> 迭代轨迹
              </h2>
              <ol>
                {project.iterations.map((iteration) => (
                  <li key={iteration.version}>
                    <span className="timeline__dot" aria-hidden="true" />
                    <strong>{iteration.version}</strong>
                    <em>{iteration.note}</em>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="provenance">
            <h2>
              <span aria-hidden="true">ⓘ</span> 数据说明
            </h2>
            {project.provenance.source === 'github' ? (
              <p>
                这条记录来自公开 GitHub 搜索快照{fetched(project) ? `（抓到于 ${fetched(project)}）` : ''}，
                字段直接取自仓库公开信息，展馆未改写作者原意。
                {project.provenance.htmlUrl && (
                  <>
                    {' '}
                    <a href={project.provenance.htmlUrl} target="_blank" rel="noreferrer noopener">
                      仓库地址 ↗
                    </a>
                  </>
                )}
              </p>
            ) : (
              <p>
                这是展馆内置的示例条目，用于展示字段与交互，不代表真实作者的作品。
                运行 <code>npm run fetch:github</code> 后，真实作品会以“GitHub 实时”标记出现在这里。
              </p>
            )}
          </section>
        </aside>
      </div>

      <section className="comments" data-testid="comment-section">
        <h2>
          <span aria-hidden="true">💬</span> 评论 {comments.length}
        </h2>

        {profile ? (
          <form
            className="comments__form"
            onSubmit={(event) => {
              event.preventDefault()
              submitComment()
            }}
          >
            <label>
              <span>评论正文</span>
              <textarea
                rows={3}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="说说你对这件作品的看法"
              />
            </label>
            <div className="comments__form-actions">
              <button type="submit" className="btn btn--primary">
                发表评论
              </button>
              <span className="comments__as">
                以 <strong>{profile.nickname}</strong>
                {profile.handle && <em>@{profile.handle}</em>} 发表 · 每条 +{CREDIT_RULES.comment.amount} 积分（当前{' '}
                {summarize(creditState.entries).balance}）
              </span>
            </div>
            {commentIssues.length > 0 && (
              <ul className="comments__issues" role="alert">
                {commentIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </form>
        ) : (
          <div className="comments__form comments__form--locked">
            <p>
              设置本机身份后可评论 · <Link to="/me">去设置</Link>
            </p>
            <button type="button" className="btn btn--primary" disabled>
              发表评论
            </button>
          </div>
        )}

        {comments.length > 0 ? (
          <ul className="comments__list">
            {comments.map((comment) => (
              <li
                key={comment.id}
                data-testid={`comment-item-${comment.id}`}
                style={{ ['--hue-a' as string]: comment.author.hue }}
              >
                <div className="comments__head">
                  <span className="post__dot" aria-hidden="true">
                    {(comment.author.name || '匿').slice(0, 1)}
                  </span>
                  <span className="comments__who">
                    {comment.author.name || '匿名'}
                    {comment.author.handle && <em>@{comment.author.handle}</em>}
                  </span>
                  <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                  {comment.source === 'local' && <span className="chip chip--live">本机</span>}
                  {canDeleteComment(comment, profile) && (
                    <button
                      type="button"
                      className="ghost-btn comments__delete"
                      onClick={() => interactions.deleteComment(comment.id, profile)}
                    >
                      删除
                    </button>
                  )}
                </div>
                <p>{comment.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="comments__empty">还没有评论。</p>
        )}
      </section>

      {related.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>
              <span aria-hidden="true">⇢</span> 隔壁几扇门
            </h2>
            <p className="section__hint">技术栈或分类相近，可能对你也有用。</p>
          </div>
          <div className="grid grid--grid">
            {related.map((item, index) => (
              <ProjectCard key={item.id} project={item} index={index} />
            ))}
          </div>
        </section>
      )}

      {toast && <div className="toast">{toast}</div>}
    </article>
  )
}

function fetched(project: Project): string | null {
  const raw = project.provenance.fetchedAt
  return raw ? raw.slice(0, 10) : null
}
