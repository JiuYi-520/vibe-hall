import { useState } from 'react'
import type { Project } from '../data/types'
import { coverSources } from '../data/cover'
import { CoverArt } from './CoverArt'

export function ProjectCover({ project, variant = 'card' }: { project: Project; variant?: 'card' | 'hero' }) {
  const sources = coverSources(project)
  // Changing projects or an explicit URL starts the fallback sequence afresh.
  return <Cover key={sources.join('|')} project={project} variant={variant} sources={sources} />
}

function Cover({ project, variant, sources }: { project: Project; variant: 'card' | 'hero'; sources: string[] }) {
  const [index, setIndex] = useState(0)
  if (!sources[index]) return <CoverArt project={project} variant={variant} />
  return <img className={`cover cover--${variant} cover--photo`} data-testid="project-cover-image"
    src={sources[index]} alt={variant === 'hero' ? `${project.title} 的仓库预览图` : ''}
    loading={variant === 'hero' ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer"
    onError={() => setIndex((value) => value + 1)} />
}
