import type { Project } from './types'

/**
 * GitHub 官方 social preview 图：这是仓库自己的预览图（GitHub 生成），
 * 不是我们绘制的占位图，所以可以如实当作该作品的封面。
 */
export function githubCoverUrl(repoFullName: string): string {
  return `https://opengraph.githubassets.com/1/${repoFullName}`
}

/**
 * 项目封面优先级：显式字段 > GitHub 仓库派生 > 无（调用方回落到程序化封面）。
 * 演示示例数据没有真实作品图，返回 undefined 由界面走程序化封面。
 */
export function resolveCoverUrl(
  project: Pick<Project, 'coverImageUrl' | 'provenance'>,
): string | undefined {
  return coverSources(project)[0]
}

export function coverSources(project: Pick<Project, 'coverImageUrl' | 'provenance'>): string[] {
  if (project.coverImageUrl) return [project.coverImageUrl]
  const repoFullName = project.provenance?.repoFullName
  if (project.provenance?.source === 'github' && repoFullName && /^[a-z\d-]+\/[a-z\d_.-]+$/i.test(repoFullName)) {
    return [`/api/cover/${repoFullName}`, githubCoverUrl(repoFullName)]
  }
  return []
}
