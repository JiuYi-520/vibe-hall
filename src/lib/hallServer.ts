import { useCallback, useEffect, useState } from 'react'
import type { ForumPost, PostKind } from '../data/forumTypes'
import type { Wish, WishStatus } from '../data/wishTypes'
import type { CategoryId } from '../data/types'

/** 后端地址：默认本机 8787，可用 VITE_API_BASE 覆盖。 */
export const API_BASE = (import.meta.env?.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787'

const TOKEN_KEY = 'vibe-hall:token'
const TIMEOUT_MS = 3500

export type ServerStatus = 'checking' | 'online' | 'offline'

export interface ApiResult<T> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

export function getServerToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function setServerToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // 忽略
  }
}

export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, token, timeoutMs = TIMEOUT_MS }: { method?: string; body?: unknown; token?: string; timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, status: response.status, error: payload?.error?.message ?? `HTTP ${response.status}` }
    }
    return { ok: true, status: response.status, data: payload as T }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : '网络错误' }
  } finally {
    clearTimeout(timer)
  }
}

/** 探测后端是否可用；不可用就如实降级到本机模式。 */
export function useHallServer(): { status: ServerStatus; refresh: () => void } {
  const [status, setStatus] = useState<ServerStatus>('checking')

  const probe = useCallback(async () => {
    const result = await apiFetch<{ ok: boolean }>('/api/health', { timeoutMs: 2000 })
    setStatus(result.ok && result.data?.ok ? 'online' : 'offline')
  }, [])

  useEffect(() => {
    void probe()
  }, [probe])

  return { status, refresh: () => void probe() }
}

/** 在线时用当前昵称注册一台设备的令牌（不是账号，只是同一设备的凭据）。 */
export async function ensureServerToken(profile: { nickname: string; handle: string }): Promise<string> {
  const existing = getServerToken()
  if (existing) return existing
  const result = await apiFetch<{ token: string }>('/api/identity', {
    method: 'POST',
    body: { nickname: profile.nickname, handle: profile.handle },
  })
  if (result.ok && result.data?.token) {
    setServerToken(result.data.token)
    return result.data.token
  }
  return ''
}

interface ServerWish {
  id: string
  title: string
  brief: string
  category: CategoryId
  tags: string[]
  createdAt: string
  cheers: number
  cheered: boolean
  status: WishStatus
  wisher: { nickname: string; handle: string }
  claim?: { maker: { nickname: string; handle: string }; note: string; claimedAt: string }
  delivered?: { at: string; projectSlug?: string; note?: string }
  bountyAmount?: number
}

interface ServerPost {
  id: string
  title: string
  body: string
  kind: PostKind
  createdAt: string
  likes: number
  liked: boolean
  author: { nickname: string; handle: string }
  replies: { id: string; body: string; createdAt: string; author: { nickname: string; handle: string } }[]
}

const HUES: Record<string, number> = {
  tool: 212,
  game: 318,
  education: 168,
  visual: 26,
  data: 192,
  ai: 264,
  life: 44,
  sound: 286,
}

export function toWish(row: ServerWish): Wish {
  return {
    id: row.id,
    slug: row.id,
    title: row.title,
    brief: row.brief,
    category: row.category,
    tags: row.tags ?? [],
    wisher: { name: row.wisher.nickname, handle: row.wisher.handle },
    createdAt: row.createdAt,
    status: row.status,
    cheers: row.cheers,
    ...(row.claim
      ? { claim: { maker: { name: row.claim.maker.nickname, handle: row.claim.maker.handle }, note: row.claim.note, claimedAt: row.claim.claimedAt } }
      : {}),
    ...(row.delivered
      ? {
          delivered: {
            at: row.delivered.at,
            ...(row.delivered.projectSlug ? { projectSlug: row.delivered.projectSlug } : {}),
            ...(row.delivered.note ? { note: row.delivered.note } : {}),
          },
        }
      : {}),
    ...(row.bountyAmount ? { bounty: { amount: row.bountyAmount, currency: 'CNY' as const } } : {}),
    provenance: { source: 'server', note: '来自后端（多设备可见）' },
  }
}

export function toPost(row: ServerPost): ForumPost {
  return {
    id: row.id,
    slug: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    author: { nickname: row.author.nickname, handle: row.author.handle, hue: HUES[row.kind] ?? 212 },
    createdAt: row.createdAt,
    replies: row.replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      createdAt: reply.createdAt,
      author: { nickname: reply.author.nickname, handle: reply.author.handle, hue: 212 },
      source: 'server' as const,
    })),
    likes: row.likes,
    source: 'server',
  }
}

export const serverApi = {
  health: () => apiFetch<{ ok: boolean; stats: Record<string, number> }>('/api/health', { timeoutMs: 2000 }),
  register: (nickname: string, handle: string) => apiFetch<{ token: string }>('/api/identity', { method: 'POST', body: { nickname, handle } }),
  listWishes: (token?: string) => apiFetch<{ wishes: ServerWish[] }>('/api/wishes', { token }),
  createWish: (token: string, body: Record<string, unknown>) => apiFetch<{ wish: ServerWish }>('/api/wishes', { method: 'POST', body, token }),
  cheerWish: (token: string, id: string) => apiFetch<{ wish: ServerWish }>(`/api/wishes/${id}/cheer`, { method: 'POST', token }),
  claimWish: (token: string, id: string, note: string) =>
    apiFetch<{ wish: ServerWish }>(`/api/wishes/${id}/claim`, { method: 'POST', body: { note }, token }),
  deliverWish: (token: string, id: string, projectSlug: string, note: string) =>
    apiFetch<{ wish: ServerWish }>(`/api/wishes/${id}/deliver`, { method: 'POST', body: { projectSlug, note }, token }),
  listPosts: (token?: string) => apiFetch<{ posts: ServerPost[] }>('/api/posts', { token }),
  createPost: (token: string, body: Record<string, unknown>) => apiFetch<{ post: ServerPost }>('/api/posts', { method: 'POST', body, token }),
  replyPost: (token: string, id: string, body: string) =>
    apiFetch<{ post: ServerPost }>(`/api/posts/${id}/replies`, { method: 'POST', body: { body }, token }),
  likePost: (token: string, id: string) => apiFetch<{ post: ServerPost }>(`/api/posts/${id}/like`, { method: 'POST', token }),
}
