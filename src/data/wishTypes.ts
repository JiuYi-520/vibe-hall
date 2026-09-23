import type { CategoryId } from './types'

export type WishStatus = 'open' | 'claimed' | 'delivered'

export interface MakerRef {
  name: string
  handle: string
}

export interface WishClaim {
  maker: MakerRef
  note: string
  claimedAt: string
}

export interface WishDelivery {
  at: string
  /** 关联到大厅里的某件展品（slug），或给出外部链接。 */
  projectSlug?: string
  url?: string
  note?: string
}

export interface Wish {
  id: string
  slug: string
  title: string
  /** 愿望正文：想要一个什么样的东西，给谁用，解决什么问题。 */
  brief: string
  category: CategoryId
  tags: string[]
  wisher: MakerRef
  createdAt: string
  status: WishStatus
  claim?: WishClaim
  delivered?: WishDelivery
  cheers: number
  /**
   * 意向悬赏：只是「愿意请喝咖啡」量级的表达。
   * 展馆不收款、不支付、不托管，也不校验真伪。
   */
  bounty?: WishBounty
  provenance: { source: 'seed' | 'local'; note?: string }
}

export interface WishBounty {
  amount: number
  currency: 'CNY' | 'USD'
  note?: string
}

export interface WishDraft {
  title: string
  brief: string
  wisherName: string
  wisherHandle: string
  category?: CategoryId
  /** 逗号分隔的标签。 */
  tags?: string
  /** 参考链接（可选）。 */
  url?: string
  /** 意向悬赏金额，字符串形式来自表单输入；留空表示不标。 */
  bountyAmount?: string
  bountyNote?: string
}

export type WishIssueCode =
  | 'empty-title'
  | 'long-title'
  | 'short-brief'
  | 'missing-wisher'
  | 'unsafe-link'
  | 'bad-bounty'

export interface WishIssue {
  code: WishIssueCode
  detail: string
}

export interface WishPatch {
  created: Wish[]
  claims: Record<string, WishClaim>
  deliveries: Record<string, WishDelivery>
  cheers: Record<string, number>
  /** 我是否给这条愿望按过「我也想要」（可取消）。 */
  cheered: Record<string, boolean>
}

export type WishSortKey = 'newest' | 'cheers' | 'open-first'

export interface WishFilters {
  query?: string
  statuses?: WishStatus[]
  categories?: CategoryId[]
}

export type WishFailReason =
  | 'already-claimed'
  | 'already-delivered'
  | 'missing-maker'
  | 'not-claimed'
  | 'not-claimant'
  | 'missing-delivery'
  | 'not-found'

export type WishActionResult = { ok: true; wish: Wish } | { ok: false; reason: WishFailReason }

export const WISH_STATUS_META: Record<WishStatus, { label: string; tone: string; hint: string }> = {
  open: { label: '待接单', tone: 'warn', hint: '还没有人认领，谁都可以接' },
  claimed: { label: '已接单', tone: 'ok', hint: '有人认领了，正在做' },
  delivered: { label: '已交付', tone: 'mute', hint: '已经做出来了，可以去看看' },
}

export const WISH_STATUS_ORDER: WishStatus[] = ['open', 'claimed', 'delivered']

export const WISH_SORT_LABEL: Record<WishSortKey, string> = {
  'open-first': '待接单优先',
  newest: '最新',
  cheers: '最想要',
}
