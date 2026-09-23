import { useRef, type CSSProperties, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'
import type { Project } from '../data/types'
import { categoryMeta, STATUS_META } from '../data/categories'
import { formatCompact, formatDate } from '../lib/format'
import { usePrefersReducedMotion } from '../lib/hooks'
import { CoverArt } from './CoverArt'

interface ProjectCardProps {
  project: Project
  index: number
  view?: 'grid' | 'list'
}

export function ProjectCard({ project, index, view = 'grid' }: ProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const rawRotateX = useMotionValue(0)
  const rawRotateY = useMotionValue(0)
  const rotateX = useSpring(rawRotateX, { stiffness: 180, damping: 18 })
  const rotateY = useSpring(rawRotateY, { stiffness: 180, damping: 18 })
  const glowX = useMotionValue(50)
  const glowY = useMotionValue(50)
  const glow = useMotionTemplate`radial-gradient(240px circle at ${glowX}% ${glowY}%, hsl(var(--hue-a) 90% 70% / 0.22), transparent 72%)`
  const scale = useTransform(rotateX, [-6, 6], [1.012, 0.996])

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current
    if (!node || reduced) return
    const rect = node.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    glowX.set(px * 100)
    glowY.set(py * 100)
    rawRotateY.set((px - 0.5) * 10)
    rawRotateX.set(-(py - 0.5) * 10)
  }

  const onPointerLeave = () => {
    rawRotateX.set(0)
    rawRotateY.set(0)
    glowX.set(50)
    glowY.set(50)
  }

  const meta = categoryMeta(project.category)
  const status = STATUS_META[project.status]
  const doorNumber = String(index + 1).padStart(3, '0')
  const isLive = project.provenance.source === 'github'

  const style = {
    '--hue-a': meta.hue[0],
    '--hue-b': meta.hue[1],
    rotateX: reduced ? 0 : rotateX,
    rotateY: reduced ? 0 : rotateY,
    scale: reduced ? 1 : scale,
  } as unknown as CSSProperties

  return (
    <motion.article
      layout
      className={`card card--${view}`}
      style={style}
      whileHover={reduced ? undefined : { y: -6 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
    >
      <div className="card__body" ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <motion.span className="card__glow" aria-hidden="true" style={{ background: glow }} />
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
            <h3 className="card__title">{project.title}</h3>
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
                <img src={project.maker.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
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
    </motion.article>
  )
}
