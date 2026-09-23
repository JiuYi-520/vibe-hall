import { describe, expect, it } from 'vitest'
import { createIdentityBoard } from './identityStore'
import { validateProfile } from '../data/identity'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set('vibe-hall:me', initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    raw: () => map.get('vibe-hall:me') ?? null,
  }
}

describe('validateProfile', () => {
  it('要求昵称，并限制账号字符', () => {
    expect(validateProfile({ nickname: '', handle: '', hue: 212 }).map((issue) => issue.code)).toEqual(['empty-nickname'])
    expect(validateProfile({ nickname: '阿岛', handle: '中文账号', hue: 212 }).map((issue) => issue.code)).toEqual(['bad-handle'])
    expect(validateProfile({ nickname: '阿岛', handle: 'a-dao', hue: 212 })).toEqual([])
  })

  it('昵称过长会被拦下', () => {
    expect(validateProfile({ nickname: '很长的名字'.repeat(8), handle: '', hue: 212 }).map((issue) => issue.code)).toEqual([
      'long-nickname',
    ])
  })
})

describe('createIdentityBoard', () => {
  it('默认没有身份', () => {
    const board = createIdentityBoard({ storage: memoryStorage() })
    expect(board.get()).toBeNull()
  })

  it('保存后能被读到，并写入本机存储', () => {
    const storage = memoryStorage()
    const board = createIdentityBoard({ storage })
    const result = board.save({ nickname: '阿岛', handle: 'a-dao', bio: '用自然语言写前端', hue: 268 })
    expect(result.ok).toBe(true)
    expect(board.get()?.nickname).toBe('阿岛')
    expect(storage.raw()).toContain('a-dao')
  })

  it('不合法的资料会被拒绝且不覆盖已有身份', () => {
    const board = createIdentityBoard({ storage: memoryStorage() })
    board.save({ nickname: '阿岛', handle: 'a-dao', hue: 268 })
    const result = board.save({ nickname: '', handle: 'a-dao', hue: 268 })
    expect(result.ok).toBe(false)
    expect(board.get()?.nickname).toBe('阿岛')
  })

  it('存储损坏时当作没有身份而不是崩溃', () => {
    const board = createIdentityBoard({ storage: memoryStorage('{坏掉的') })
    expect(board.get()).toBeNull()
  })

  it('清空身份会移除存储并通知订阅者', () => {
    const storage = memoryStorage()
    const board = createIdentityBoard({ storage })
    let calls = 0
    board.subscribe(() => {
      calls += 1
    })
    board.save({ nickname: '阿岛', handle: 'a-dao', hue: 268 })
    board.clear()
    expect(board.get()).toBeNull()
    expect(storage.raw()).toBeNull()
    expect(calls).toBe(2)
  })
})
