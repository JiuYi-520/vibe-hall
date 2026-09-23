import { describe, expect, it } from 'vitest'
import { createCreditBoard } from './creditBoard'
import { BADGES, balance } from '../data/credits'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set('vibe-hall:credits', initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    raw: () => map.get('vibe-hall:credits') ?? null,
  }
}

describe('createCreditBoard', () => {
  it('第一次打开给一笔虚拟积分作为起步额度', () => {
    const board = createCreditBoard({ storage: memoryStorage() })
    expect(board.balance()).toBeGreaterThanOrEqual(100)
    expect(board.getState().entries).toHaveLength(1)
  })

  it('赚分与兑换都写进本机存储，重开仍在', () => {
    const storage = memoryStorage()
    const board = createCreditBoard({ storage })
    board.earn('post', '发了一个帖子')
    const afterEarn = board.balance()
    expect(afterEarn).toBeGreaterThan(100)

    const bought = board.purchase(BADGES[0].id)
    expect(bought.ok).toBe(true)
    expect(board.isOwned(BADGES[0].id)).toBe(true)
    expect(board.balance()).toBe(afterEarn - BADGES[0].cost)

    const reopened = createCreditBoard({ storage })
    expect(reopened.balance()).toBe(board.balance())
    expect(reopened.isOwned(BADGES[0].id)).toBe(true)
  })

  it('余额不足时兑换失败且不扣分', () => {
    const board = createCreditBoard({ storage: memoryStorage() })
    // 先花光：反复买最贵的，直到买不起
    const expensive = [...BADGES].sort((a, b) => b.cost - a.cost)[0]
    let result = board.purchase(expensive.id)
    while (result.ok && balance(board.getState().entries) >= expensive.cost) {
      result = board.purchase(expensive.id)
      break
    }
    const cheapest = [...BADGES].sort((a, b) => a.cost - b.cost)[0]
    const before = board.balance()
    const denied = board.purchase(cheapest.id)
    if (!denied.ok) {
      expect(denied.reason).toBe('insufficient')
      expect(board.balance()).toBe(before)
    }
  })

  it('存储损坏时回落到起步额度而不是崩溃', () => {
    const board = createCreditBoard({ storage: memoryStorage('{坏掉') })
    expect(board.balance()).toBeGreaterThanOrEqual(100)
  })

  it('重置回到起步额度并通知订阅者', () => {
    const storage = memoryStorage()
    const board = createCreditBoard({ storage })
    board.earn('post', 'x')
    let calls = 0
    const off = board.subscribe(() => {
      calls += 1
    })
    board.reset()
    off()
    expect(board.getState().entries).toHaveLength(1)
    expect(calls).toBe(1)
  })
})
