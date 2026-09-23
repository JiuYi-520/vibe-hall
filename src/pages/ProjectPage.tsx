import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Project } from '../data/types'
import { loadProjects } from '../data/loadProjects'
import { categoryMeta, STATUS_META } from '../data/categories'
import { pickRelated } from '../data/queries'
import { formatCompact, formatDate, readingTime } from '../lib/format'
import { useCopy, useScrollProgress } from '../lib/hooks'
import { CoverArt } from '../components/CoverArt'
import { ProjectCard } from '../components/ProjectCard'

const LINK_LABEL: Record<string, string> = {
  demo: '打开作品',
  repo: '查看源码',
  video: '看演示',
  article: '读记录',
  prompt: '看提示词',
}

interface ProjectPageProps {
  projects?: Project[]
}

const bundle = loadProjects()

export function ProjectPage({ projects = bundle.projects }: ProjectPageProps) {
  const { slug } = useParams()
  const project = projects.find((item) => item.slug === slug)
  const progress = useScrollProgress()
  const [toast, copy] = useCopy()
  const related = useMemo(() => (project ? pickRelated(projects, project, 3) : []), [projects, project])

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
        <motion.div
          className="detail__visual"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <CoverArt project={project} variant="hero" />
        </motion.div>
        <motion.div
          className="detail__intro"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06 }}
        >
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
        </motion.div>
      </header>

      <div className="detail__grid">
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
