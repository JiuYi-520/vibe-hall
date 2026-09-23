import { useSyncExternalStore } from 'react'
import { sanitizeProfile, validateProfile, type IdentityIssue, type LocalProfile } from '../data/identity'

const STORAGE_KEY = 'vibe-hall:me'

export interface IdentityStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface IdentityBoard {
  get(): LocalProfile | null
  save(profile: LocalProfile): { ok: true; profile: LocalProfile } | { ok: false; issues: IdentityIssue[] }
  clear(): void
  subscribe(listener: () => void): () => void
}

/**
 * 本机身份：存在本机浏览器里的「署名」，不是账号。
 * 没有密码、没有验证、也没有服务端会话——界面必须这样告诉用户。
 */
export function createIdentityBoard({
  storage,
  key = STORAGE_KEY,
}: {
  storage?: IdentityStorage
  key?: string
}): IdentityBoard {
  const listeners = new Set<() => void>()
  let profile: LocalProfile | null = null

  try {
    const raw = storage?.getItem(key) ?? null
    if (raw) profile = sanitizeProfile(JSON.parse(raw))
  } catch {
    profile = null
  }

  const notify = () => {
    for (const listener of listeners) listener()
  }

  return {
    get: () => profile,
    save(next) {
      const issues = validateProfile(next)
      if (issues.length > 0) return { ok: false, issues }
      const clean = sanitizeProfile(next)
      if (!clean) return { ok: false, issues: [{ code: 'empty-nickname', detail: '昵称不能为空' }] }
      profile = clean
      try {
        storage?.setItem(key, JSON.stringify(clean))
      } catch {
        // 写入失败时内存里仍然生效
      }
      notify()
      return { ok: true, profile: clean }
    },
    clear() {
      profile = null
      try {
        storage?.removeItem(key)
      } catch {
        // 忽略
      }
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const browserStorage: IdentityStorage | undefined =
  typeof window !== 'undefined' && 'localStorage' in window ? window.localStorage : undefined

export const identityBoard: IdentityBoard = createIdentityBoard({ storage: browserStorage })

export function useIdentity(board: IdentityBoard = identityBoard): LocalProfile | null {
  return useSyncExternalStore(
    board.subscribe,
    () => board.get(),
    () => board.get(),
  )
}
