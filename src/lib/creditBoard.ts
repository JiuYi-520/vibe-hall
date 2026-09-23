import { useSyncExternalStore } from 'react'
import type { CreditReason, CreditState, PurchaseResult } from '../data/creditTypes'
import { balance, exportCredits, initialEntries, makeEntry, purchase } from '../data/credits'

const STORAGE_KEY = 'vibe-hall:credits'

export interface CreditStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface CreditBoard {
  getState(): CreditState
  subscribe(listener: () => void): () => void
  balance(): number
  isOwned(badgeId: string): boolean
  earn(reason: CreditReason, note: string, now?: Date): void
  purchase(badgeId: string, now?: Date): PurchaseResult
  reset(): void
  exportJson(at?: string): string
}

function isState(value: unknown): value is CreditState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CreditState>
  return Array.isArray(candidate.entries) && Array.isArray(candidate.owned)
}

/**
 * 积分账本：本机记录 + 可导出。虚拟点，不是钱（见 creditTypes 的说明）。
 */
export function createCreditBoard({
  storage,
  key = STORAGE_KEY,
}: {
  storage?: CreditStorage
  key?: string
}): CreditBoard {
  const listeners = new Set<() => void>()
  let state: CreditState = { entries: initialEntries(), owned: [] }
  let sequence = 0

  try {
    const raw = storage?.getItem(key) ?? null
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isState(parsed)) state = { entries: [...parsed.entries], owned: [...parsed.owned] }
    }
  } catch {
    state = { entries: initialEntries(), owned: [] }
  }

  const persist = (next: CreditState) => {
    state = next
    try {
      storage?.setItem(key, JSON.stringify(next))
    } catch {
      // 写入失败时内存里仍生效
    }
    for (const listener of listeners) listener()
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    balance: () => balance(state.entries),
    isOwned: (badgeId) => state.owned.includes(badgeId),
    earn(reason, note, now = new Date()) {
      sequence += 1
      persist({ ...state, entries: [...state.entries, makeEntry(reason, note, now, sequence)] })
    },
    purchase(badgeId, now = new Date()) {
      const result = purchase(state, badgeId, now)
      if (result.ok) persist(result.state)
      return result
    },
    reset() {
      try {
        storage?.removeItem(key)
      } catch {
        // 忽略
      }
      state = { entries: initialEntries(), owned: [] }
      for (const listener of listeners) listener()
    },
    exportJson: (at) => exportCredits(state, at),
  }
}

const browserStorage: CreditStorage | undefined =
  typeof window !== 'undefined' && 'localStorage' in window ? window.localStorage : undefined

export const creditBoard: CreditBoard = createCreditBoard({ storage: browserStorage })

export function useCredits(board: CreditBoard = creditBoard): CreditState {
  return useSyncExternalStore(board.subscribe, board.getState, board.getState)
}
