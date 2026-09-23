import { useSyncExternalStore } from 'react'
import type { Comment, CommentAuthor, CommentIssue, InteractionState } from '../data/interactionTypes'
import { canDeleteComment, exportInteractions, makeLocalComment, toggleLikedMap, validateComment } from '../data/interactions'

const STORAGE_KEY = 'vibe-hall:interactions'

export interface InteractionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface InteractionBoard {
  getState(): InteractionState
  subscribe(listener: () => void): () => void
  isLiked(slug: string): boolean
  toggleLike(slug: string): void
  addComment(
    projectSlug: string,
    author: CommentAuthor,
    body: string,
    now?: Date,
  ): { ok: true; comment: Comment } | { ok: false; issues: CommentIssue[] }
  deleteComment(id: string, profile: { nickname: string; handle: string } | null): boolean
  reset(): void
  exportJson(at?: string): string
}

function isState(value: unknown): value is InteractionState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<InteractionState>
  return !!candidate.liked && typeof candidate.liked === 'object' && Array.isArray(candidate.comments)
}

/**
 * 展品互动（点赞 / 评论）：和愿望、帖子用同一套模式——本机存储 + 纯函数领域层 + 导出。
 * 没有后端，所以这里只记「我」的动作。
 */
export function createInteractionBoard({
  storage,
  key = STORAGE_KEY,
}: {
  storage?: InteractionStorage
  key?: string
}): InteractionBoard {
  const listeners = new Set<() => void>()
  let state: InteractionState = { liked: {}, comments: [] }
  let sequence = 0

  try {
    const raw = storage?.getItem(key) ?? null
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isState(parsed)) state = { liked: { ...parsed.liked }, comments: [...parsed.comments] }
    }
  } catch {
    state = { liked: {}, comments: [] }
  }

  const persist = (next: InteractionState) => {
    state = next
    try {
      storage?.setItem(key, JSON.stringify(next))
    } catch {
      // 写入失败时内存里仍然生效
    }
    for (const listener of listeners) listener()
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isLiked: (slug) => Boolean(state.liked[slug]),
    toggleLike(slug) {
      persist({ ...state, liked: toggleLikedMap(state.liked, slug) })
    },
    addComment(projectSlug, author, body, now = new Date()) {
      const issues = validateComment({ author, body })
      if (issues.length > 0) return { ok: false, issues }
      sequence += 1
      const comment = makeLocalComment(projectSlug, author, body, now, sequence)
      persist({ ...state, comments: [comment, ...state.comments] })
      return { ok: true, comment }
    },
    deleteComment(id, profile) {
      const target = state.comments.find((comment) => comment.id === id)
      if (!target || !canDeleteComment(target, profile)) return false
      persist({ ...state, comments: state.comments.filter((comment) => comment.id !== id) })
      return true
    },
    reset() {
      try {
        storage?.removeItem(key)
      } catch {
        // 忽略
      }
      state = { liked: {}, comments: [] }
      for (const listener of listeners) listener()
    },
    exportJson: (at) => exportInteractions(state, at),
  }
}

const browserStorage: InteractionStorage | undefined =
  typeof window !== 'undefined' && 'localStorage' in window ? window.localStorage : undefined

export const interactionBoard: InteractionBoard = createInteractionBoard({ storage: browserStorage })

export function useInteractions(board: InteractionBoard = interactionBoard): InteractionState {
  return useSyncExternalStore(board.subscribe, board.getState, board.getState)
}
