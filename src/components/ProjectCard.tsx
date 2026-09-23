import { useRef, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Project } from '../data/types'
import { categoryMeta, STATUS_META } from '../data/categories'
import { formatCompact, formatDate } from '../lib/format'
import { usePrefersReducedMotion } from '../lib/hooks'
import { CoverArt } from './CoverArt'
import { Highlighted } from './Highlighted'

interface ProjectCardProps {
  project: Project
  index: number
  view?: 'grid' | 'list'
  /** 当前搜索词：命中部分会高亮。 */
  highlight?: string
}

/**
 * 倾斜与光斑直接在 DOM 上写 CSS 变量（每帧最多一次），
 * 不触发 React 重渲染，也不依赖动画库，卡片数量增加时主线程开销保持恒定。
 */
export function ProjectCard({ project, index, view = 'grid', highlight }: ProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const reduced = usePrefersReducedMotion()

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current
    if (!node || reduced || frame.current) return
    const rect = node.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0
      node.style.setProperty('--tilt-x', `${((0.5 - py) * 8).toFixed(2)}deg`)
      node.style.setProperty('--tilt-y', `${((px - 0.5) * 10).toFixed(2)}deg`)
      node.style.setProperty('--glow-x', `${(px * 100).toFixed(1)}%`)
      node.style.setProperty('--glow-y', `${(py * 100).toFixed(1)}%`)
    })
  }

  const onPointerLeave = () => {
    const node = ref.current
    if (!node) return
    if (frame.current) {
      window.cancelAnimationFrame(frame.current)
      frame.current = 0
    }
    node.style.setProperty('--tilt-x', '0deg')
    node.style.setProperty('--tilt-y', '0deg')
    node.style.setProperty('--glow-x', '50%')
    node.style.setProperty('--glow-y', '50%')
  }

  const meta = categoryMeta(project.category)
  const status = STATUS_META[project.status]
  const doorNumber = String(index + 1).padStart(3, '0')
  const isLive = project.provenance.source === 'github'

  return (
    <article
      className={`card card--${view}`}
      style={
        {
          '--hue-a': meta.hue[0],
          '--hue-b': meta.hue[1],
          '--i': Math.min(index, 10),
        } as React.CSSProperties
      }
    >
      <div className="card__body" ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <span className="card__glow" aria-hidden="true" />
        <Link className="card__link" to={`/p/${project.slug}`} aria-label={`${project.title} — ${project.tagline}`}>
          <span className="card__door" aria-hidden="true">
            {doorNumber}
          </span>
          <CoverArt project={project} />
          <div className="card__main">
            <div className="card__top">
              <span className="chip chip--ghost">
                {meta.glyph} {meta.label}
              </span>
              <span className={`chip chip--${status.tone}`}>{status.label}</span>
              <span className={`chip chip--${isLive ? 'live' : 'seed'}`}>{isLive ? 'GitHub 实时' : '示例'}</span>
            </div>
            <h3 className="card__title">
              <Highlighted text={project.title} query={highlight} />
            </h3>
            <p className="card__tagline">{project.tagline}</p>
            <ul className="card__stack" aria-label="技术栈">
              {project.stack.slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {project.stack.length > 4 && <li className="card__stack-more">+{project.stack.length - 4}</li>}
            </ul>
          </div>
          <div className="card__foot">
            <span className="card__maker">
              {project.maker.avatarUrl ? (
                <img src={project.maker.avatarUrl} alt="" width={22} height={22} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              ) : (
                <span className="card__maker-dot" aria-hidden="true">
                  {project.maker.name.slice(0, 1)}
                </span>
              )}
              {project.maker.name}
              <em>@{project.maker.handle}</em>
            </span>
            <span className="card__metrics">
              {project.likes > 0 && <span title="鼓掌数">👏 {formatCompact(project.likes)}</span>}
              {typeof project.stars === 'number' && project.stars > 0 && (
                <span title="GitHub 星标">★ {formatCompact(project.stars)}</span>
              )}
              <time dateTime={project.createdAt}>{formatDate(project.createdAt)}</time>
            </span>
          </div>
        </Link>
      </div>
    </article>
  )
}
