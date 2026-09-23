import type { Project } from './types'
import type { Comment, CommentAuthor, CommentIssue, InteractionState } from './interactionTypes'
import { MAX_COMMENT } from './interactionTypes'

export type { Comment, CommentAuthor, CommentIssue, InteractionState } from './interactionTypes'
export { MAX_COMMENT } from './interactionTypes'

function stamp(now: Date): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function validateComment({ author, body }: { author: CommentAuthor; body: string }): CommentIssue[] {
  const issues: CommentIssue[] = []
  const text = body.trim()
  if (!text) issues.push({ code: 'empty-body', detail: '评论不能为空' })
  else if (text.length > MAX_COMMENT) issues.push({ code: 'long-body', detail: `评论不要超过 ${MAX_COMMENT} 字` })
  if (!author.name.trim() && !author.handle.trim()) issues.push({ code: 'missing-author', detail: '请先设置本机身份' })
  return issues
}

export function makeLocalComment(
  projectSlug: string,
  author: CommentAuthor,
  body: string,
  now = new Date(),
  sequence = 0,
): Comment {
  return {
    id: `local-${now.getTime().toString(36)}-${sequence}`,
    projectSlug,
    author: { name: author.name.trim(), handle: author.handle.trim().replace(/^@/, ''), hue: author.hue },
    body: body.trim(),
    createdAt: stamp(now),
    source: 'local',
  }
}

export function toggleLikedMap(liked: Record<string, boolean>, slug: string): Record<string, boolean> {
  return { ...liked, [slug]: !liked[slug] }
}

/** 本机点赞叠加到展品自带的热度之上。 */
export function applyLikes(projects: Project[], liked: Record<string, boolean>): Project[] {
  return projects.map((project) => {
    const extra = liked[project.slug] ? 1 : 0
    return extra ? { ...project, likes: project.likes + extra } : project
  })
}

export function countComments(comments: Comment[], slug: string): number {
  return comments.filter((comment) => comment.projectSlug === slug).length
}

export function listComments(seed: Comment[], local: Comment[], slug: string): Comment[] {
  const mine = local.filter((comment) => comment.projectSlug === slug)
  const theirs = seed.filter((comment) => comment.projectSlug === slug)
  return [...mine, ...theirs]
}

/** 只有本机发的、且署名匹配的评论才能删。 */
export function canDeleteComment(
  comment: Comment,
  profile: { nickname: string; handle: string } | null,
): boolean {
  if (!profile || comment.source !== 'local') return false
  const same = (left: string, right: string) =>
    Boolean(left.trim()) && Boolean(right.trim()) && left.trim().replace(/^@/, '').toLowerCase() === right.trim().replace(/^@/, '').toLowerCase()
  // 删除是权限判断：双方都有账号时必须以账号为准（昵称可以重名），只有昵称时才退回昵称比对
  if (comment.author.handle.trim() && profile.handle.trim()) return same(comment.author.handle, profile.handle)
  return same(comment.author.name, profile.nickname)
}

export function exportInteractions(state: InteractionState, at = new Date().toISOString()): string {
  return JSON.stringify(
    {
      schema: 'vibe-hall.interactions.v1',
      exportedAt: at,
      likedCount: Object.values(state.liked).filter(Boolean).length,
      commentCount: state.comments.length,
      liked: state.liked,
      comments: state.comments,
    },
    null,
    2,
  )
}
