import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProjectCard } from './ProjectCard'
import type { Project } from '../data/types'

const githubProject: Project = {
  id: 'gh-1',
  slug: 'xintaofei-codeg',
  title: 'Codeg',
  tagline: '协同多智能体编码工作台',
  story: '仓库自述（原文）：…',
  category: 'ai',
  tags: ['agent'],
  stack: ['TypeScript'],
  maker: { name: 'xintaofei', handle: 'xintaofei' },
  links: [{ kind: 'repo', label: '查看源码', url: 'https://github.com/xintaofei/codeg' }],
  createdAt: '2026-01-01',
  likes: 0,
  stars: 3665,
  featured: true,
  status: 'live',
  provenance: {
    source: 'github',
    repoFullName: 'xintaofei/codeg',
    htmlUrl: 'https://github.com/xintaofei/codeg',
  },
}

const seedProject: Project = {
  ...githubProject,
  id: 'seed-01',
  slug: 'neon-kanban',
  title: '霓虹看板',
  stars: undefined,
  provenance: { source: 'seed', note: '演示示例数据' },
}

function renderCard(project: Project) {
  return render(
    <MemoryRouter>
      <ProjectCard project={project} index={0} />
    </MemoryRouter>,
  )
}

describe('ProjectCard 封面', () => {
  it('GitHub 记录优先渲染本站缓存封面，且懒加载、不带 referrer', () => {
    renderCard(githubProject)

    const image = screen.getByTestId('project-cover-image') as HTMLImageElement
    expect(image.getAttribute('src')).toBe('/api/cover/xintaofei/codeg')
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('decoding')).toBe('async')
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('本站缓存取不到时退回 GitHub 原图', () => {
    renderCard(githubProject)

    fireEvent.error(screen.getByTestId('project-cover-image'))

    expect(screen.getByTestId('project-cover-image').getAttribute('src')).toBe(
      'https://opengraph.githubassets.com/1/xintaofei/codeg',
    )
  })

  it('两张图都失败才回落到程序化封面', () => {
    renderCard(githubProject)

    fireEvent.error(screen.getByTestId('project-cover-image'))
    fireEvent.error(screen.getByTestId('project-cover-image'))

    expect(screen.queryByTestId('project-cover-image')).toBeNull()
    expect(screen.getByTestId('project-cover-art')).toBeTruthy()
  })

  it('没有真实封面的记录直接使用程序化封面', () => {
    renderCard(seedProject)

    expect(screen.queryByTestId('project-cover-image')).toBeNull()
    expect(screen.getByTestId('project-cover-art')).toBeTruthy()
  })
})
