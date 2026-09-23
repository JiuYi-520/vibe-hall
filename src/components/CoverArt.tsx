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
  /** Compact covers drop the extra decoration for list rows. */
  variant?: 'card' | 'hero'
}

/**
 * Deterministic procedural cover: same slug always paints the same door,
 * and nothing is fetched from a third party at runtime.
 */
export function CoverArt({ project, variant = 'card' }: CoverArtProps) {
  const art = useMemo(() => {
    const seed = hash(project.slug)
    const [baseA, baseB] = categoryMeta(project.category).hue
    // Deterministic per-project wobble so two entries in one category still look different.
    const wobble = (seed % 46) - 23
    const hueA = (baseA + wobble + 360) % 360
    const hueB = (baseB - wobble * 0.6 + 360) % 360
    const rotate = seed % 360
    const dots = Array.from({ length: 22 }, (_, index) => {
      const local = hash(`${project.slug}:${index}`)
      return {
        x: 6 + (local % 88),
        y: 8 + ((local >> 7) % 84),
        r: 0.6 + ((local >> 13) % 22) / 10,
        delay: ((local >> 5) % 60) / 10,
      }
    })
    return { seed, hueA, hueB, rotate, dots }
  }, [project.slug, project.category])

  const id = `cover-${project.slug}`

  return (
    <div className={`cover cover--${variant}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="cover__svg">
        <defs>
          <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1" gradientTransform={`rotate(${art.rotate} 0.5 0.5)`}>
            <stop offset="0%" stopColor={`hsl(${art.hueA} 88% 62%)`} stopOpacity="0.95" />
            <stop offset="52%" stopColor={`hsl(${(art.hueA + art.hueB) / 2} 76% 44%)`} stopOpacity="0.85" />
            <stop offset="100%" stopColor={`hsl(${art.hueB} 82% 26%)`} stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-blur`}>
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <rect width="100" height="100" fill={`url(#${id}-base)`} />
        <g filter={`url(#${id}-blur)`} opacity="0.75">
          <circle cx={20 + (art.seed % 30)} cy={70} r="26" fill={`hsl(${art.hueB} 90% 60%)`} opacity="0.5" />
          <circle cx={78 - (art.seed % 26)} cy={24} r="22" fill={`hsl(${art.hueA + 30} 90% 66%)`} opacity="0.45" />
        </g>
        <rect width="100" height="100" fill={`url(#${id}-glow)`} opacity="0.5" />
        {variant === 'hero' && (
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
        )}
        <g stroke="#0b0b12" strokeOpacity="0.18" strokeWidth="0.4">
          {Array.from({ length: 9 }, (_, index) => (
            <line key={index} x1={(index + 1) * 10} y1="0" x2={(index + 1) * 10} y2="100" />
          ))}
        </g>
      </svg>
      <span className="cover__glyph">{categoryMeta(project.category).glyph}</span>
    </div>
  )
}
