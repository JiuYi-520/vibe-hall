import { useMemo } from 'react'
import type { Project } from '../data/types'
import { categoryMeta } from '../data/categories'

function hash(text: string): number {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return Math.abs(value)
}

interface CoverArtProps {
  project: Project
  /** hero 变体用在详情页，带缓慢闪烁的光点；card 变体是纯 CSS，不给列表增加 DOM。 */
  variant?: 'card' | 'hero'
}

/**
 * 程序化封面：同一个 slug 永远画出同一扇门，运行时不依赖任何第三方图片。
 */
export function CoverArt({ project, variant = 'card' }: CoverArtProps) {
  const art = useMemo(() => {
    const seed = hash(project.slug)
    const [baseA, baseB] = categoryMeta(project.category).hue
    // 按 slug 做色相抖动：同一分类下的两件作品也不会撞门面。
    const wobble = (seed % 46) - 23
    const hueA = (baseA + wobble + 360) % 360
    const hueB = (baseB - wobble * 0.6 + 360) % 360
    const dots = Array.from({ length: 22 }, (_, index) => {
      const local = hash(`${project.slug}:${index}`)
      return {
        x: 6 + (local % 88),
        y: 8 + ((local >> 7) % 84),
        r: 0.6 + ((local >> 13) % 22) / 10,
        delay: ((local >> 5) % 60) / 10,
      }
    })
    return { seed, hueA, hueB, rotate: seed % 360, dots }
  }, [project.slug, project.category])

  const glyph = categoryMeta(project.category).glyph
  const style = {
    '--hue-a': art.hueA,
    '--hue-b': art.hueB,
    '--cover-rotate': `${art.rotate}deg`,
    '--blob-1-x': `${18 + (art.seed % 34)}%`,
    '--blob-1-y': `${62 + (art.seed % 12)}%`,
    '--blob-2-x': `${58 + ((art.seed >> 3) % 30)}%`,
    '--blob-2-y': `${14 + ((art.seed >> 5) % 22)}%`,
  } as React.CSSProperties

  if (variant === 'card') {
    return (
      <div className="cover cover--card" style={style} aria-hidden="true" data-testid="project-cover-art">
        <span className="cover__glyph">{glyph}</span>
      </div>
    )
  }

  const id = `cover-${project.slug}`
  return (
    <div className="cover cover--hero" style={style} aria-hidden="true" data-testid="project-cover-art">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="cover__svg">
        <defs>
          <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1" gradientTransform={`rotate(${art.rotate} 0.5 0.5)`}>
            <stop offset="0%" stopColor={`hsl(${art.hueA} 88% 62%)`} stopOpacity="0.95" />
            <stop offset="52%" stopColor={`hsl(${(art.hueA + art.hueB) / 2} 76% 44%)`} stopOpacity="0.85" />
            <stop offset="100%" stopColor={`hsl(${art.hueB} 82% 26%)`} stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${id}-base)`} />
        <g>
          {art.dots.map((dot, index) => (
            <circle
              key={index}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill="#ffffff"
              opacity="0.5"
              className="cover__spark"
              style={{ animationDelay: `${dot.delay}s` }}
            />
          ))}
        </g>
      </svg>
      <span className="cover__glyph">{glyph}</span>
    </div>
  )
}
