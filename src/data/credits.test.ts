import { describe, expect, it } from 'vitest'
import {
  BADGES,
  badgeById,
  balance,
  exportCredits,
  initialEntries,
  makeEntry,
  purchase,
  summarize,
} from './credits'
import type { CreditEntry, CreditState } from './creditTypes'

const ada = new Date('2026-09-23T10:00:00Z')

function entry(overrides: Partial<CreditEntry> = {}): CreditEntry {
  return {
    id: 'e1',
    amount: 10,
    reason: 'post',
    note: '发了一个帖子',
    at: '2026-09-23',
    ...overrides,
  }
}

function state(overrides: Partial<CreditState> = {}): CreditState {
  return { entries: [entry()], owned: [], ...overrides }
}

describe('积分规则与初始余额', () => {
  it('每个赚分动作都是正数，兑换本身不计分', () => {
    for (const reason of ['wish', 'post', 'reply', 'comment', 'claim', 'deliver'] as const) {
      expect(balance([makeEntry(reason, '', ada, 1)])).toBeGreaterThan(0)
    }
  })

  it('初始赠送让新人有分可用，且标明是虚拟积分', () => {
    const entries = initialEntries(ada)
    expect(entries).toHaveLength(1)
    expect(entries[0].reason).toBe('welcome')
    expect(entries[0].note).toContain('虚拟')
    expect(balance(entries)).toBeGreaterThanOrEqual(100)
  })
})

describe('makeEntry / balance', () => {
  it('记一条流水：金额来自规则，带日期与本机 id', () => {
    const created = makeEntry('deliver', '交付了「晾衣提醒」', ada, 2)
    expect(created.reason).toBe('deliver')
    expect(created.amount).toBeGreaterThan(10)
    expect(created.at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(created.id).toContain('credit-')
  })

  it('余额是流水求和，可以为负（不该发生，但别撒谎）', () => {
    expect(balance([])).toBe(0)
    expect(balance([entry({ amount: 10 }), entry({ id: 'e2', amount: -30 })])).toBe(-20)
  })
})

describe('summarize', () => {
  it('统计余额、总收入、总支出与今日净额', () => {
    const today = new Date()
    const stamp = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
    const summary = summarize([
      entry({ id: 'a', amount: 100, reason: 'welcome', at: stamp }),
      entry({ id: 'b', amount: 10, reason: 'post', at: stamp }),
      entry({ id: 'c', amount: -60, reason: 'purchase', at: stamp }),
      entry({ id: 'd', amount: 5, reason: 'comment', at: '2020-01-01' }),
    ])
    expect(summary.balance).toBe(55)
    expect(summary.earned).toBe(115)
    expect(summary.spent).toBe(60)
    expect(summary.today).toBe(50)
  })
})

describe('purchase', () => {
  it('余额够时可以买下徽章，并追加一笔负流水', () => {
    const rich = state({ entries: [entry({ amount: 200 })], owned: [] })
    const badge = BADGES[0]
    const result = purchase(rich, badge.id, ada)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.owned).toContain(badge.id)
    expect(balance(result.state.entries)).toBe(200 - badge.cost)
    expect(result.state.entries.at(-1)?.reason).toBe('purchase')
    expect(result.state.entries.at(-1)?.amount).toBe(-badge.cost)
  })

  it('买过的不再重复扣分，余额不足时拒绝', () => {
    const badge = BADGES[0]
    const owned = state({ entries: [entry({ amount: 500 })], owned: [badge.id] })
    expect(purchase(owned, badge.id, ada)).toEqual({ ok: false, reason: 'owned' })

    const poor = state({ entries: [entry({ amount: 1 })], owned: [] })
    expect(purchase(poor, badge.id, ada)).toEqual({ ok: false, reason: 'insufficient' })
    expect(balance(poor.entries)).toBe(1)
  })

  it('不修改传入的状态', () => {
    const rich = state({ entries: [entry({ amount: 300 })], owned: [] })
    purchase(rich, BADGES[0].id, ada)
    expect(rich.owned).toHaveLength(0)
    expect(rich.entries).toHaveLength(1)
  })
})

describe('徽章与导出', () => {
  it('徽章表非空、价格为正、id 唯一、能按 id 查回', () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(4)
    expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(BADGES.length)
    for (const badge of BADGES) {
      expect(badge.cost).toBeGreaterThan(0)
      expect(badgeById(badge.id)?.name).toBe(badge.name)
    }
    expect(badgeById('nope')).toBeNull()
  })

  it('导出流水写明这是虚拟积分而不是钱', () => {
    const json = JSON.parse(exportCredits(state(), '2026-09-23T00:00:00.000Z'))
    expect(json.schema).toBe('vibe-hall.credits.v1')
    expect(json.exportedAt).toBe('2026-09-23T00:00:00.000Z')
    expect(json.disclaimer).toContain('虚拟')
    expect(json.balance).toBe(10)
    expect(json.entries).toHaveLength(1)
  })
})
