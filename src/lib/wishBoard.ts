import { useSyncExternalStore } from 'react'
import type { Wish, WishActionResult, WishDelivery, WishDraft, WishIssue, WishPatch } from '../data/wishTypes'
import { applyPatch, emptyPatch, exportWishes, makeLocalWish, validateWishDraft, claimWish, deliverWish } from '../data/wishes'
import { seedWishes } from '../data/wishSeed'
import { withDemo } from '../data/demo'

const STORAGE_KEY = 'vibe-hall:wishes'

/** 只依赖这三个方法，测试里可以直接塞内存实现。 */
export interface WishStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface WishBoard {
  getState(): { wishes: Wish[]; patch: WishPatch }
  subscribe(listener: () => void): () => void
  createWish(draft: WishDraft, now?: Date): { ok: true; wish: Wish } | { ok: false; issues: WishIssue[] }
  claim(id: string, maker: { name: string; handle: string }, note: string, now?: Date): WishActionResult
  deliver(id: string, actorHandle: string, delivery: { projectSlug?: string; url?: string; note?: string }, now?: Date): WishActionResult
  cheer(id: string): void
  isCheered(id: string): boolean
  toggleCheer(id: string): void
  reset(): void
  exportJson(at?: string): string
}

function isPatch(value: unknown): value is WishPatch {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<WishPatch>
  return Array.isArray(candidate.created) && !!candidate.claims && !!candidate.deliveries && !!candidate.cheers
}

export function createWishBoard({
  seeds,
  storage,
  key = STORAGE_KEY,
}: {
  seeds: Wish[]
  storage?: WishStorage
  key?: string
}): WishBoard {
  const listeners = new Set<() => void>()
  let patch: WishPatch = emptyPatch()
  let cache: Wish[] | null = null
  let sequence = 0

  try {
    const raw = storage?.getItem(key) ?? null
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isPatch(parsed)) patch = { ...emptyPatch(), ...parsed }
    }
  } catch {
    // 存储损坏：保留空改动，绝不让页面崩掉
    patch = emptyPatch()
  }

  const persist = () => {
    cache = null
    try {
      storage?.setItem(key, JSON.stringify(patch))
    } catch {
      // 无痕模式等场景下写入失败：内存里的改动仍然生效
    }
    for (const listener of listeners) listener()
  }

  const state = () => {
    cache ??= applyPatch(seeds, patch)
    return cache
  }

  const find = (id: string) => state().find((wish) => wish.id === id)

  return {
    getState: () => ({ wishes: state(), patch }),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    createWish(draft, now = new Date()) {
      const issues = validateWishDraft(draft)
      if (issues.length > 0) return { ok: false, issues }
      sequence += 1
      const wish = makeLocalWish(draft, now, sequence)
      patch = { ...patch, created: [wish, ...patch.created] }
      persist()
      return { ok: true, wish }
    },
    claim(id, maker, note, now = new Date()) {
      const wish = find(id)
      if (!wish) return { ok: false, reason: 'not-found' }
      const result = claimWish(wish, maker, note, now)
      if (!result.ok) return result
      patch = { ...patch, claims: { ...patch.claims, [id]: result.wish.claim! } }
      persist()
      return result
    },
    deliver(id, actorHandle, delivery, now = new Date()) {
      const wish = find(id)
      if (!wish) return { ok: false, reason: 'not-found' }
      const result = deliverWish(wish, actorHandle, delivery, now)
      if (!result.ok) return result
      patch = { ...patch, deliveries: { ...patch.deliveries, [id]: result.wish.delivered as WishDelivery } }
      persist()
      return result
    },
    cheer(id) {
      if (!find(id)) return
      patch = { ...patch, cheers: { ...patch.cheers, [id]: (patch.cheers[id] ?? 0) + 1 } }
      persist()
    },
    isCheered: (id) => Boolean(patch.cheered?.[id]),
    toggleCheer(id) {
      if (!find(id)) return
      patch = { ...patch, cheered: { ...patch.cheered, [id]: !patch.cheered?.[id] } }
      persist()
    },
    reset() {
      patch = emptyPatch()
      try {
        storage?.removeItem(key)
      } catch {
        // 忽略
      }
      cache = null
      for (const listener of listeners) listener()
    },
    exportJson: (at) => exportWishes(state(), at),
  }
}

const browserStorage: WishStorage | undefined =
  typeof window !== 'undefined' && 'localStorage' in window ? window.localStorage : undefined

/** 全站唯一的愿望板实例（浏览器里落盘到 localStorage）。 */
export const wishBoard: WishBoard = createWishBoard({
  seeds: withDemo(seedWishes),
  storage: browserStorage,
})

export function useWishes(board: WishBoard = wishBoard): Wish[] {
  return useSyncExternalStore(
    board.subscribe,
    () => board.getState().wishes,
    () => board.getState().wishes,
  )
}
