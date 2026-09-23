import type { CategoryId } from './types'
import { CATEGORY_LABEL } from './categories'
import { slugify } from '../lib/format'
import type {
  MakerRef,
  Wish,
  WishActionResult,
  WishDelivery,
  WishDraft,
  WishFilters,
  WishIssue,
  WishIssueCode,
  WishPatch,
  WishSortKey,
} from './wishTypes'

export type {
  Wish,
  WishActionResult,
  WishClaim,
  WishDelivery,
  WishDraft,
  WishFailReason,
  WishFilters,
  WishIssue,
  WishPatch,
  WishSortKey,
  WishStatus,
  WishBounty,
} from './wishTypes'
export { WISH_SORT_LABEL, WISH_STATUS_META, WISH_STATUS_ORDER } from './wishTypes'

const MIN_BRIEF = 10
const MAX_TITLE = 60
const MAX_BOUNTY = 100_000
const SAFE_LINK = /^(https?:\/\/|[./#])/i

/** 意向悬赏只接受正整数金额；这里是「请喝咖啡」量级，不是报价单。 */
export function parseBountyAmount(raw?: string): number | null {
  const text = (raw ?? '').trim()
  if (!text) return null
  if (!/^\d+$/.test(text)) return null
  const amount = Number(text)
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_BOUNTY) return null
  return amount
}

function stamp(now: Date): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function emptyPatch(): WishPatch {
  return { created: [], claims: {}, deliveries: {}, cheers: {} }
}

export function cheerWish(wish: Wish): Wish {
  return { ...wish, cheers: wish.cheers + 1 }
}

export function claimWish(wish: Wish, maker: MakerRef, note: string, now = new Date()): WishActionResult {
  if (wish.status === 'delivered') return { ok: false, reason: 'already-delivered' }
  if (wish.status === 'claimed') return { ok: false, reason: 'already-claimed' }
  if (!maker.name.trim() && !maker.handle.trim()) return { ok: false, reason: 'missing-maker' }

  return {
    ok: true,
    wish: {
      ...wish,
      status: 'claimed',
      claim: { maker: { name: maker.name.trim(), handle: maker.handle.trim() }, note: note.trim(), claimedAt: stamp(now) },
    },
  }
}

export function deliverWish(
  wish: Wish,
  actorHandle: string,
  delivery: { projectSlug?: string; url?: string; note?: string },
  now = new Date(),
): WishActionResult {
  if (wish.status === 'delivered') return { ok: false, reason: 'already-delivered' }
  if (wish.status !== 'claimed' || !wish.claim) return { ok: false, reason: 'not-claimed' }
  if (wish.claim.maker.handle.toLowerCase() !== actorHandle.trim().toLowerCase()) return { ok: false, reason: 'not-claimant' }
  if (!delivery.projectSlug && !delivery.url?.trim()) return { ok: false, reason: 'missing-delivery' }

  const delivered: WishDelivery = { at: stamp(now) }
  if (delivery.projectSlug) delivered.projectSlug = delivery.projectSlug
  if (delivery.url?.trim()) delivered.url = delivery.url.trim()
  if (delivery.note?.trim()) delivered.note = delivery.note.trim()

  return { ok: true, wish: { ...wish, status: 'delivered', delivered } }
}

export function validateWishDraft(draft: WishDraft): WishIssue[] {
  const issues: WishIssue[] = []
  const title = draft.title.trim()
  const brief = draft.brief.trim()

  if (!title) issues.push({ code: 'empty-title', detail: '愿望标题不能为空' })
  else if (title.length > MAX_TITLE) issues.push({ code: 'long-title', detail: `愿望标题不要超过 ${MAX_TITLE} 字` })

  if (brief.length < MIN_BRIEF) issues.push({ code: 'short-brief', detail: `愿望描述至少写 ${MIN_BRIEF} 个字，说清给谁用、解决什么` })
  if (!draft.wisherName.trim() && !draft.wisherHandle.trim()) issues.push({ code: 'missing-wisher', detail: '至少留一个署名或账号' })
  if (draft.url && draft.url.trim() && !SAFE_LINK.test(draft.url.trim())) {
    issues.push({ code: 'unsafe-link', detail: '参考链接必须是 http(s):// 开头' })
  }
  if ((draft.bountyAmount ?? '').trim() && parseBountyAmount(draft.bountyAmount) === null) {
    issues.push({ code: 'bad-bounty', detail: `悬赏只能填 1 - ${MAX_BOUNTY} 的整数金额（不收款，只是意向）` })
  }
  return issues
}

export function makeLocalWish(draft: WishDraft, now = new Date(), sequence = 0): Wish {
  const title = draft.title.trim()
  const base = slugify(title) || 'wish'
  const bountyAmount = parseBountyAmount(draft.bountyAmount)
  return {
    id: `local-${now.getTime().toString(36)}-${sequence}`,
    slug: `${base}-${now.getTime().toString(36).slice(-4)}`,
    title,
    brief: draft.brief.trim(),
    category: draft.category ?? 'life',
    tags: (draft.tags ?? '')
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
    wisher: { name: draft.wisherName.trim() || draft.wisherHandle.trim().replace(/^@/, ''), handle: draft.wisherHandle.trim().replace(/^@/, '') },
    createdAt: stamp(now),
    status: 'open',
    cheers: 0,
    ...(bountyAmount
      ? { bounty: { amount: bountyAmount, currency: 'CNY' as const, ...(draft.bountyNote?.trim() ? { note: draft.bountyNote.trim() } : {}) } }
      : {}),
    provenance: { source: 'local', note: '你在本机贴的愿望，只保存在这台浏览器里' },
  }
}

/** 把三张叠加表（想要数 / 接单 / 交付）作用到一个愿望上；种子和本机贴的愿望用同一条路径。 */
function applyExtras(wish: Wish, patch: WishPatch): Wish {
  const extraCheers = patch.cheers[wish.id] ?? 0
  const claim = patch.claims[wish.id] ?? wish.claim
  const delivery = patch.deliveries[wish.id]
  const next: Wish = { ...wish }

  if (extraCheers > 0) next.cheers = wish.cheers + extraCheers
  if (claim && next.status === 'open') {
    next.status = 'claimed'
    next.claim = claim
  }
  if (delivery && next.status !== 'delivered') {
    next.status = 'delivered'
    next.delivered = delivery
    if (!next.claim) next.claim = { maker: { name: '（未记录）', handle: '' }, note: '', claimedAt: delivery.at }
  }
  return next
}

/**
 * 把本地改动叠加到种子之上；种子内容更新后不会被旧快照冻结。
 * 本机新贴的愿望同样要过这三张叠加表，否则它们永远接不了单。
 */
export function applyPatch(seeds: Wish[], patch: WishPatch): Wish[] {
  return [...patch.created.map((wish) => applyExtras(wish, patch)), ...seeds.map((wish) => applyExtras(wish, patch))]
}

function wishText(wish: Wish): string {
  return [wish.title, wish.brief, wish.tags.join(' '), wish.wisher.name, wish.wisher.handle, CATEGORY_LABEL[wish.category] ?? '']
    .join(' ')
    .toLowerCase()
}

export function filterWishes(wishes: Wish[], filters: WishFilters): Wish[] {
  const terms = (filters.query ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  return wishes.filter((wish) => {
    if (filters.statuses?.length && !filters.statuses.includes(wish.status)) return false
    if (filters.categories?.length && !filters.categories.includes(wish.category)) return false
    if (terms.length === 0) return true
    const haystack = wishText(wish)
    return terms.every((term) => haystack.includes(term))
  })
}

function time(iso: string): number {
  const value = new Date(iso).getTime()
  return Number.isNaN(value) ? 0 : value
}

export function sortWishes(wishes: Wish[], sort: WishSortKey): Wish[] {
  const copy = [...wishes]
  switch (sort) {
    case 'cheers':
      return copy.sort((a, b) => b.cheers - a.cheers || time(b.createdAt) - time(a.createdAt))
    case 'open-first': {
      const weight = (wish: Wish) => (wish.status === 'open' ? 0 : wish.status === 'claimed' ? 1 : 2)
      return copy.sort((a, b) => weight(a) - weight(b) || time(b.createdAt) - time(a.createdAt))
    }
    case 'newest':
    default:
      return copy.sort((a, b) => time(b.createdAt) - time(a.createdAt))
  }
}

export function wishStats(wishes: Wish[]): { total: number; open: number; claimed: number; delivered: number } {
  return {
    total: wishes.length,
    open: wishes.filter((wish) => wish.status === 'open').length,
    claimed: wishes.filter((wish) => wish.status === 'claimed').length,
    delivered: wishes.filter((wish) => wish.status === 'delivered').length,
  }
}

export function exportWishes(wishes: Wish[], at = new Date().toISOString()): string {
  return JSON.stringify(
    {
      schema: 'vibe-hall.wishes.v1',
      exportedAt: at,
      count: wishes.length,
      wishes,
    },
    null,
    2,
  )
}

export function wishCategories(wishes: Wish[]): { id: CategoryId; count: number }[] {
  const map = new Map<string, number>()
  for (const wish of wishes) map.set(wish.category, (map.get(wish.category) ?? 0) + 1)
  return [...map]
    .map(([id, count]) => ({ id: id as CategoryId, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
}

export const WISH_ISSUE_CODES: WishIssueCode[] = [
  'empty-title',
  'long-title',
  'short-brief',
  'missing-wisher',
  'unsafe-link',
  'bad-bounty',
]
