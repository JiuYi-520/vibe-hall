import { slugify } from '../lib/format'
import type {
  ForumActionResult,
  ForumAuthor,
  ForumDraft,
  ForumFilters,
  ForumIssue,
  ForumPatch,
  ForumPost,
  ForumReply,
  ForumSortKey,
} from './forumTypes'

export type {
  ForumActionResult,
  ForumAuthor,
  ForumDraft,
  ForumFilters,
  ForumIssue,
  ForumPatch,
  ForumPost,
  ForumReply,
  ForumSortKey,
  PostKind,
} from './forumTypes'
export { FORUM_SORT_LABEL, POST_KIND_META, POST_KIND_ORDER } from './forumTypes'

const MIN_BODY = 10
const MAX_TITLE = 60

function stamp(now: Date): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function hasAuthor(author: ForumAuthor): boolean {
  return Boolean(author.nickname.trim() || author.handle.trim())
}

export function emptyForumPatch(): ForumPatch {
  return { created: [], replies: {}, likes: {} }
}

export function validateForumDraft(draft: ForumDraft): ForumIssue[] {
  const issues: ForumIssue[] = []
  const title = draft.title.trim()
  const body = draft.body.trim()

  if (!title) issues.push({ code: 'empty-title', detail: '标题不能为空' })
  else if (title.length > MAX_TITLE) issues.push({ code: 'long-title', detail: `标题不要超过 ${MAX_TITLE} 字` })
  if (body.length < MIN_BODY) issues.push({ code: 'short-body', detail: `正文至少 ${MIN_BODY} 个字` })
  if (!hasAuthor(draft.author)) issues.push({ code: 'missing-author', detail: '请先设置本机身份' })
  return issues
}

export function makeLocalPost(draft: ForumDraft, now = new Date(), sequence = 0): ForumPost {
  const title = draft.title.trim()
  const suffix = now.getTime().toString(36).slice(-4)
  return {
    id: `local-${now.getTime().toString(36)}-${sequence}`,
    slug: `${slugify(title) || 'post'}-${suffix}`,
    title,
    body: draft.body.trim(),
    kind: draft.kind,
    author: { nickname: draft.author.nickname.trim(), handle: draft.author.handle.trim().replace(/^@/, ''), hue: draft.author.hue },
    createdAt: stamp(now),
    replies: [],
    likes: 0,
    source: 'local',
  }
}

export function addReply(post: ForumPost, author: ForumAuthor, body: string, now = new Date()): ForumActionResult {
  if (!hasAuthor(author)) return { ok: false, reason: 'missing-author' }
  const text = body.trim()
  if (text.length < 2) return { ok: false, reason: 'empty-reply' }

  const reply: ForumReply = {
    id: `r-${now.getTime().toString(36)}-${post.replies.length + 1}`,
    author: { nickname: author.nickname.trim(), handle: author.handle.trim().replace(/^@/, ''), hue: author.hue },
    body: text,
    createdAt: stamp(now),
    source: 'local',
  }
  return { ok: true, post: { ...post, replies: [...post.replies, reply] } }
}

export function likePost(post: ForumPost): ForumPost {
  return { ...post, likes: post.likes + 1 }
}

export function applyForumPatch(seeds: ForumPost[], patch: ForumPatch): ForumPost[] {
  const merge = (post: ForumPost): ForumPost => {
    const extraReplies = patch.replies[post.id] ?? []
    const extraLikes = patch.likes[post.id] ?? 0
    return {
      ...post,
      replies: [...post.replies, ...extraReplies],
      likes: post.likes + extraLikes,
    }
  }
  return [...patch.created.map(merge), ...seeds.map(merge)]
}

function searchText(post: ForumPost): string {
  return [post.title, post.body, post.author.nickname, post.author.handle, ...post.replies.map((reply) => reply.body)]
    .join(' ')
    .toLowerCase()
}

export function filterPosts(posts: ForumPost[], filters: ForumFilters): ForumPost[] {
  const terms = (filters.query ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  return posts.filter((post) => {
    if (filters.kinds?.length && !filters.kinds.includes(post.kind)) return false
    if (terms.length === 0) return true
    const haystack = searchText(post)
    return terms.every((term) => haystack.includes(term))
  })
}

function time(iso: string): number {
  const value = new Date(iso).getTime()
  return Number.isNaN(value) ? 0 : value
}

export function sortPosts(posts: ForumPost[], sort: ForumSortKey): ForumPost[] {
  const copy = [...posts]
  switch (sort) {
    case 'likes':
      return copy.sort((a, b) => b.likes - a.likes || time(b.createdAt) - time(a.createdAt))
    case 'active':
      return copy.sort((a, b) => b.replies.length - a.replies.length || time(b.createdAt) - time(a.createdAt))
    case 'newest':
    default:
      return copy.sort((a, b) => time(b.createdAt) - time(a.createdAt))
  }
}

export function forumStats(posts: ForumPost[]): { posts: number; replies: number; authors: number; today: number } {
  const authors = new Set<string>()
  const today = new Date()
  const todayStamp = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  let replies = 0
  let createdToday = 0

  for (const post of posts) {
    replies += post.replies.length
    if (post.author.handle || post.author.nickname) authors.add(post.author.handle || post.author.nickname)
    if (post.createdAt === todayStamp) createdToday += 1
  }

  return { posts: posts.length, replies, authors: authors.size, today: createdToday }
}

/** 只填了昵称（没有账号）的人也要统计得到，所以 handle 与昵称都参与匹配。 */
export function countMyContributions(posts: ForumPost[], handle: string, nickname?: string): { posts: number; replies: number } {
  const handleKey = handle.trim().replace(/^@/, '').toLowerCase()
  const nameKey = (nickname ?? '').trim().toLowerCase()
  if (!handleKey && !nameKey) return { posts: 0, replies: 0 }
  const mine = (author: ForumAuthor) => {
    const authorHandle = author.handle.trim().replace(/^@/, '').toLowerCase()
    const authorName = author.nickname.trim().toLowerCase()
    return Boolean((handleKey && authorHandle === handleKey) || (nameKey && authorName === nameKey))
  }
  return {
    posts: posts.filter((post) => mine(post.author)).length,
    replies: posts.reduce((total, post) => total + post.replies.filter((reply) => mine(reply.author)).length, 0),
  }
}

export function exportForum(posts: ForumPost[], at = new Date().toISOString()): string {
  return JSON.stringify({ schema: 'vibe-hall.forum.v1', exportedAt: at, count: posts.length, posts }, null, 2)
}
