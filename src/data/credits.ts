import type { Badge, CreditEntry, CreditReason, CreditState, PurchaseResult } from './creditTypes'

export type { Badge, CreditEntry, CreditReason, CreditState, PurchaseFailure, PurchaseResult } from './creditTypes'

export const CREDIT_RULES: Record<CreditReason, { amount: number; label: string }> = {
  welcome: { amount: 120, label: '新展馆赠送的虚拟积分' },
  wish: { amount: 5, label: '贴了一条愿望' },
  post: { amount: 10, label: '发了一个帖子' },
  reply: { amount: 3, label: '回复了帖子' },
  comment: { amount: 5, label: '评论了作品' },
  claim: { amount: 8, label: '接了一个愿望' },
  deliver: { amount: 20, label: '交付了一个愿望' },
  purchase: { amount: 0, label: '兑换了徽章' },
}

/** 馆内虚拟徽章：只用积分兑换，没有实物、没有现金价值。 */
export const BADGES: Badge[] = [
  { id: 'early-bird', name: '早鸟', cost: 30, hue: 38, note: '开馆早期就来了' },
  { id: 'night-owl', name: '夜猫', cost: 40, hue: 268, note: '深夜还在做东西' },
  { id: 'door-collector', name: '门牌收藏家', cost: 60, hue: 212, note: '爱看别人的门牌' },
  { id: 'wish-maker', name: '许愿的人', cost: 80, hue: 168, note: '贴过不止一条愿望' },
  { id: 'handyman', name: '接单的人', cost: 100, hue: 154, note: '接过别人的愿望' },
  { id: 'patron', name: '展馆赞助人（虚拟）', cost: 160, hue: 318, note: '积分花得最多的人' },
]

export const CREDITS_DISCLAIMER = '展馆积分是虚拟点，不是钱：不能充值、不能提现、没有真实价值，只用于兑换馆内虚拟徽章。'

export function badgeById(id: string): Badge | null {
  return BADGES.find((badge) => badge.id === id) ?? null
}

function stamp(now: Date): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function makeEntry(reason: CreditReason, note: string, now = new Date(), sequence = 0): CreditEntry {
  const rule = CREDIT_RULES[reason]
  return {
    id: `credit-${now.getTime().toString(36)}-${sequence}`,
    amount: rule.amount,
    reason,
    note: note || rule.label,
    at: stamp(now),
  }
}

export function initialEntries(now = new Date()): CreditEntry[] {
  return [makeEntry('welcome', CREDIT_RULES.welcome.label, now, 0)]
}

export function balance(entries: CreditEntry[]): number {
  return entries.reduce((total, item) => total + item.amount, 0)
}

export function summarize(entries: CreditEntry[], now = new Date()): { balance: number; earned: number; spent: number; today: number } {
  const today = stamp(now)
  let earned = 0
  let spent = 0
  let todayNet = 0
  for (const item of entries) {
    if (item.amount >= 0) earned += item.amount
    else spent += -item.amount
    if (item.at === today) todayNet += item.amount
  }
  return { balance: balance(entries), earned, spent, today: todayNet }
}

export function isOwned(state: CreditState, badgeId: string): boolean {
  return state.owned.includes(badgeId)
}

export function purchase(state: CreditState, badgeId: string, now = new Date()): PurchaseResult {
  const badge = badgeById(badgeId)
  if (!badge) return { ok: false, reason: 'unknown' }
  if (isOwned(state, badgeId)) return { ok: false, reason: 'owned' }
  if (balance(state.entries) < badge.cost) return { ok: false, reason: 'insufficient' }

  const entry: CreditEntry = {
    id: `credit-${now.getTime().toString(36)}-buy`,
    amount: -badge.cost,
    reason: 'purchase',
    note: `兑换徽章：${badge.name}`,
    at: stamp(now),
  }
  return { ok: true, state: { entries: [...state.entries, entry], owned: [...state.owned, badgeId] } }
}

export function exportCredits(state: CreditState, at = new Date().toISOString()): string {
  return JSON.stringify(
    {
      schema: 'vibe-hall.credits.v1',
      exportedAt: at,
      disclaimer: CREDITS_DISCLAIMER,
      balance: balance(state.entries),
      owned: state.owned,
      entries: state.entries,
    },
    null,
    2,
  )
}
