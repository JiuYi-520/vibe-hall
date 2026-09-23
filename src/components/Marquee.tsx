import type { Project } from '../data/types'
import { Link } from 'react-router-dom'
import { categoryMeta } from '../data/categories'

export function Marquee({ projects }: { projects: Project[] }) {
  const row = projects.slice(0, 12)

  return (
    <div className="marquee" aria-label="最近入馆的作品">
      <div className="marquee__track">
        {[0, 1].map((copy) => (
          <ul className="marquee__row" key={copy} aria-hidden={copy === 1}>
            {row.map((project) => (
              <li key={`${copy}-${project.id}`}>
                <Link to={`/p/${project.slug}`} tabIndex={copy === 1 ? -1 : 0}>
                  <span aria-hidden="true">{categoryMeta(project.category).glyph}</span>
                  {project.title}
                  <em>@{project.maker.handle}</em>
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
