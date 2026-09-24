import { useEffect, useSyncExternalStore } from 'react'
import { type ApiResult, apiFetch } from './hallServer'
import { identityBoard } from './identityStore'

export interface AuthUser {
  id: number
  nickname: string
  handle: string
  bio: string
  hue: number
}

export type AuthState = {
  status: 'idle' | 'loading' | 'anonymous' | 'authenticated' | 'error'
  user: AuthUser | null
  error: string
}

type AuthApi = {
  authMe: () => Promise<ApiResult<{ user: AuthUser }>>
  register: (input: Record<string, unknown>) => Promise<ApiResult<{ user: AuthUser }>>
  login: (input: { handle: string; password: string }) => Promise<ApiResult<{ user: AuthUser }>>
  logout: () => Promise<ApiResult<unknown>>
  updateProfile: (input: Partial<Pick<AuthUser, 'nickname' | 'handle' | 'bio' | 'hue'>>) => Promise<ApiResult<{ user: AuthUser }>>
}

const defaultApi: AuthApi = {
  authMe: () => apiFetch<{ user: AuthUser }>('/api/auth/me'),
  register: (input) => apiFetch<{ user: AuthUser }>('/api/auth/register', { method: 'POST', body: input }),
  login: (input) => apiFetch<{ user: AuthUser }>('/api/auth/login', { method: 'POST', body: input }),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
  updateProfile: (input) => apiFetch<{ user: AuthUser }>('/api/profile', { method: 'PATCH', body: input }),
}

function localize(user: AuthUser | null) {
  if (!user) return
  identityBoard.save({ nickname: user.nickname, handle: user.handle, bio: user.bio, hue: user.hue })
}

export function createAuthStore({ api = defaultApi }: { api?: AuthApi } = {}) {
  let state: AuthState = { status: 'idle', user: null, error: '' }
  let loading = false
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  const set = (next: AuthState) => {
    state = next
    localize(next.user)
    notify()
  }

  const resultError = <T,>(result: ApiResult<T>, fallback: string) => result.error || fallback

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async load() {
      if (loading || state.status === 'authenticated') return state
      loading = true
      set({ status: 'loading', user: null, error: '' })
      const result = await api.authMe()
      loading = false
      if (result.ok && result.data?.user) set({ status: 'authenticated', user: result.data.user, error: '' })
      else if (result.status === 401) set({ status: 'anonymous', user: null, error: '' })
      else set({ status: 'error', user: null, error: resultError(result, '登录状态暂不可用') })
      return state
    },
    async register(input: Record<string, unknown>) {
      const result = await api.register(input)
      if (!result.ok || !result.data?.user) {
        set({ status: 'anonymous', user: null, error: resultError(result, '注册失败') })
        return result
      }
      set({ status: 'authenticated', user: result.data.user, error: '' })
      return result
    },
    async login(input: { handle: string; password: string }) {
      const result = await api.login(input)
      if (!result.ok || !result.data?.user) {
        set({ status: 'anonymous', user: null, error: resultError(result, '登录失败') })
        return result
      }
      set({ status: 'authenticated', user: result.data.user, error: '' })
      return result
    },
    async logout() {
      const result = await api.logout()
      set({ status: 'anonymous', user: null, error: result.ok ? '' : resultError(result, '退出失败') })
      return result
    },
    async updateProfile(input: Partial<Pick<AuthUser, 'nickname' | 'handle' | 'bio' | 'hue'>>) {
      const result = await api.updateProfile(input)
      if (!result.ok || !result.data?.user) {
        set({ ...state, error: resultError(result, '保存资料失败') })
        return result
      }
      set({ status: 'authenticated', user: result.data.user, error: '' })
      return result
    },
  }
}

export const authStore = createAuthStore()

export function useAuth() {
  const state = useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get)
  useEffect(() => {
    void authStore.load()
  }, [])
  return state
}
