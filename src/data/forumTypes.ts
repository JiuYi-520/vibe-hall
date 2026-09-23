export type PostKind = 'ask' | 'share' | 'showcase' | 'recruit' | 'chat'

export interface ForumAuthor {
  nickname: string
  handle: string
  hue: number
}

export interface ForumReply {
  id: string
  author: ForumAuthor
  body: string
  createdAt: string
  source: 'seed' | 'local'
}

export interface ForumPost {
  id: string
  slug: string
  title: string
  body: string
  kind: PostKind
  author: ForumAuthor
  createdAt: string
  replies: ForumReply[]
  likes: number
  source: 'seed' | 'local'
}

export interface ForumDraft {
  title: string
  body: string
  kind: PostKind
  author: ForumAuthor
}

export type ForumIssueCode = 'empty-title' | 'long-title' | 'short-body' | 'missing-author'

export interface ForumIssue {
  code: ForumIssueCode
  detail: string
}

export interface ForumPatch {
  created: ForumPost[]
  replies: Record<string, ForumReply[]>
  likes: Record<string, number>
  /** 我是否给这条帖子点过赞（可取消）。 */
  liked: Record<string, boolean>
}

export type ForumSortKey = 'newest' | 'active' | 'likes'

export type ForumFailReason = 'empty-title' | 'short-body' | 'missing-author' | 'empty-reply' | 'not-found'

export type ForumActionResult = { ok: true; post: ForumPost } | { ok: false; reason: ForumFailReason }

export interface ForumFilters {
  query?: string
  kinds?: PostKind[]
}

export const POST_KIND_META: Record<PostKind, { label: string; tone: string; hint: string }> = {
  ask: { label: '求助', tone: 'warn', hint: '遇到问题，问问大家' },
  share: { label: '经验', tone: 'ok', hint: '踩过的坑、总结出来的做法' },
  showcase: { label: '作品', tone: 'live', hint: '做完了，贴出来给人看' },
  recruit: { label: '招募', tone: 'ghost', hint: '想找人一起做' },
  chat: { label: '闲聊', tone: 'mute', hint: '跟作品无关的话' },
}

export const POST_KIND_ORDER: PostKind[] = ['ask', 'share', 'showcase', 'recruit', 'chat']

export const FORUM_SORT_LABEL: Record<ForumSortKey, string> = {
  newest: '最新',
  active: '回复最多',
  likes: '最热',
}
