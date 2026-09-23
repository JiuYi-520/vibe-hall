export interface CommentAuthor {
  name: string
  handle: string
  hue: number
}

export interface Comment {
  id: string
  /** 评论挂在哪件展品上。 */
  projectSlug: string
  author: CommentAuthor
  body: string
  createdAt: string
  source: 'seed' | 'local'
}

export type CommentIssueCode = 'empty-body' | 'long-body' | 'missing-author'

export interface CommentIssue {
  code: CommentIssueCode
  detail: string
}

export interface InteractionState {
  /** slug -> 是否点过赞；false 表示明确取消过。 */
  liked: Record<string, boolean>
  /** 本机发的评论（种子评论另存）。 */
  comments: Comment[]
}

export const MAX_COMMENT = 240
