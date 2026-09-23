/**
 * 展馆积分：**虚拟点，不是钱**。
 * 不能充值、不能提现、没有真实价值，也不参与任何结算；只用来记账与兑换馆内虚拟徽章。
 */
export type CreditReason = 'welcome' | 'wish' | 'post' | 'reply' | 'comment' | 'claim' | 'deliver' | 'purchase'

export interface CreditEntry {
  id: string
  amount: number
  reason: CreditReason
  note: string
  at: string
}

export interface Badge {
  id: string
  name: string
  cost: number
  hue: number
  note: string
}

export interface CreditState {
  entries: CreditEntry[]
  owned: string[]
}

export type PurchaseFailure = 'owned' | 'insufficient' | 'unknown'

export type PurchaseResult = { ok: true; state: CreditState } | { ok: false; reason: PurchaseFailure }
