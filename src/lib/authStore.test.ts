import { describe, expect, it, vi } from 'vitest'
import { createAuthStore } from './authStore'

const user = { id: 1, nickname: '林子', handle: 'lin-zi', bio: '做工具', hue: 268 }

function makeApi() {
  return {
    authMe: vi.fn().mockResolvedValue({ ok: false, status: 401, error: '请先登录' }),
    register: vi.fn().mockResolvedValue({ ok: true, status: 201, data: { user } }),
    login: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { user } }),
    logout: vi.fn().mockResolvedValue({ ok: true, status: 204 }),
    updateProfile: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { user: { ...user, bio: '更新简介' } } }),
  }
}

describe('authStore', () => {
  it('登录后保存服务端用户并允许更新资料与退出', async () => {
    const api = makeApi()
    const store = createAuthStore({ api })

    await store.login({ handle: 'lin-zi', password: 'correct horse battery staple' })
    expect(store.get()).toMatchObject({ status: 'authenticated', user })

    await store.updateProfile({ nickname: '林子', handle: 'lin-zi', bio: '更新简介', hue: 268 })
    expect(store.get().user?.bio).toBe('更新简介')

    await store.logout()
    expect(store.get()).toMatchObject({ status: 'anonymous', user: null })
    expect(api.logout).toHaveBeenCalledOnce()
  })
})
