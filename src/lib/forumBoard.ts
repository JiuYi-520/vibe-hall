import { useSyncExternalStore } from 'react'
import type { ForumAuthor, ForumDraft, ForumIssue, ForumPatch, ForumPost, ForumReply } from '../data/forumTypes'
import { addReply, applyForumPatch, emptyForumPatch, exportForum, makeLocalPost, validateForumDraft } from '../data/forum'
import { seedPosts } from '../data/forumSeed'

const STORAGE_KEY = 'vibe-hall:forum'

export interface ForumStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ForumBoard {
  getState(): { posts: ForumPost[]; patch: ForumPatch }
  subscribe(listener: () => void): () => void
  createPost(draft: ForumDraft, now?: Date): { ok: true; post: ForumPost } | { ok: false; issues: ForumIssue[] }
  reply(
    id: string,
    author: ForumAuthor,
    body: string,
    now?: Date,
  ): { ok: true; post: ForumPost; reply: ForumReply } | { ok: false; reason: string }
  like(id: string): void
  reset(): void
  exportJson(at?: string): string
}

function isPatch(value: unknown): value is ForumPatch {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ForumPatch>
  return Array.isArray(candidate.created) && !!candidate.replies && !!candidate.likes
}

export function createForumBoard({
  seeds,
  storage,
  key = STORAGE_KEY,
}: {
  seeds: ForumPost[]
  storage?: ForumStorage
  key?: string
}): ForumBoard {
  const listeners = new Set<() => void>()
  let patch: ForumPatch = emptyForumPatch()
  let cache: ForumPost[] | null = null
  let sequence = 0

  try {
    const raw = storage?.getItem(key) ?? null
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isPatch(parsed)) patch = { ...emptyForumPatch(), ...parsed }
    }
  } catch {
    patch = emptyForumPatch()
  }

  const persist = () => {
    cache = null
    try {
      storage?.setItem(key, JSON.stringify(patch))
    } catch {
      // 忽略写入失败
    }
    for (const listener of listeners) listener()
  }

  const state = () => {
    cache ??= applyForumPatch(seeds, patch)
    return cache
  }
  const find = (id: string) => state().find((post) => post.id === id)

  return {
    getState: () => ({ posts: state(), patch }),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    createPost(draft, now = new Date()) {
      const issues = validateForumDraft(draft)
      if (issues.length > 0) return { ok: false, issues }
      sequence += 1
      const post = makeLocalPost(draft, now, sequence)
      patch = { ...patch, created: [post, ...patch.created] }
      persist()
      return { ok: true, post }
    },
    reply(id, author, body, now = new Date()) {
      const post = find(id)
      if (!post) return { ok: false, reason: 'not-found' }
      const result = addReply(post, author, body, now)
      if (!result.ok) return { ok: false, reason: result.reason }
      const reply = result.post.replies[result.post.replies.length - 1]
      patch = { ...patch, replies: { ...patch.replies, [id]: [...(patch.replies[id] ?? []), reply] } }
      persist()
      return { ok: true, post: result.post, reply }
    },
    like(id) {
      const post = find(id)
      if (!post) return
      patch = { ...patch, likes: { ...patch.likes, [id]: (patch.likes[id] ?? 0) + 1 } }
      persist()
    },
    reset() {
      patch = emptyForumPatch()
      try {
        storage?.removeItem(key)
      } catch {
        // 忽略
      }
      cache = null
      for (const listener of listeners) listener()
    },
    exportJson: (at) => exportForum(state(), at),
  }
}

const browserStorage: ForumStorage | undefined =
  typeof window !== 'undefined' && 'localStorage' in window ? window.localStorage : undefined

export const forumBoard: ForumBoard = createForumBoard({ seeds: seedPosts, storage: browserStorage })

export function useForumPosts(board: ForumBoard = forumBoard): ForumPost[] {
  return useSyncExternalStore(
    board.subscribe,
    () => board.getState().posts,
    () => board.getState().posts,
  )
}
