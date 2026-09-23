import { describe, expect, it } from 'vitest'
import type { Wish } from './wishTypes'
import {
  applyPatch,
  cheerWish,
  claimWish,
  deliverWish,
  emptyPatch,
  exportWishes,
  filterWishes,
  sortWishes,
  validateWishDraft,
  wishStats,
} from './wishes'

function makeWish(overrides: Partial<Wish> = {}): Wish {
  return {
    id: 'w1',
    slug: 'w-one',
    title: '想要一个自动整理划线的东西',
    brief: '把阅读器里的划线自动整理成卡片，按主题分组。',
    category: 'tool',
    tags: ['阅读'],
    wisher: { name: '小满', handle: 'xiaoman' },
    createdAt: '2026-09-01',
    status: 'open',
    cheers: 3,
    provenance: { source: 'seed' },
    ...overrides,
  }
}

describe('claimWish', () => {
  it('让待接单的愿望进入已接单并记录接单人', () => {
    const result = claimWish(makeWish(), { name: '阿岛', handle: 'a-dao' }, '先做最小版本')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.wish.status).toBe('claimed')
    expect(result.wish.claim?.maker.handle).toBe('a-dao')
    expect(result.wish.claim?.note).toBe('先做最小版本')
    expect(result.wish.claim?.claimedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })

  it('拒绝重复接单和已交付的愿望', () => {
    const claimed = makeWish({ status: 'claimed', claim: { maker: { name: 'A', handle: 'a' }, note: '', claimedAt: '2026-09-02' } })
    expect(claimWish(claimed, { name: 'B', handle: 'b' }, '')).toEqual({ ok: false, reason: 'already-claimed' })
    expect(claimWish(makeWish({ status: 'delivered' }), { name: 'B', handle: 'b' }, '')).toEqual({
      ok: false,
      reason: 'already-delivered',
    })
  })

  it('要求接单人留下可识别的署名', () => {
    expect(claimWish(makeWish(), { name: '', handle: '' }, '')).toEqual({ ok: false, reason: 'missing-maker' })
    expect(claimWish(makeWish(), { name: '只有名字', handle: '' }, '').ok).toBe(true)
  })

  it('不修改传入的对象', () => {
    const wish = makeWish()
    claimWish(wish, { name: '阿岛', handle: 'a-dao' }, '')
    expect(wish.status).toBe('open')
    expect(wish.claim).toBeUndefined()
  })
})

describe('deliverWish', () => {
  const claimed = makeWish({
    status: 'claimed',
    claim: { maker: { name: '阿岛', handle: 'a-dao' }, note: '', claimedAt: '2026-09-02' },
  })

  it('只允许接单人交付，并且必须带关联作品或链接', () => {
    expect(deliverWish(claimed, 'someone-else', { projectSlug: 'neon-kanban' })).toEqual({ ok: false, reason: 'not-claimant' })
    expect(deliverWish(claimed, 'a-dao', {})).toEqual({ ok: false, reason: 'missing-delivery' })
    expect(deliverWish(makeWish(), 'a-dao', { projectSlug: 'neon-kanban' })).toEqual({ ok: false, reason: 'not-claimed' })
  })

  it('交付成功后记录时间与关联作品', () => {
    const result = deliverWish(claimed, 'a-dao', { projectSlug: 'neon-kanban', note: '做完了' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.wish.status).toBe('delivered')
    expect(result.wish.delivered?.projectSlug).toBe('neon-kanban')
    expect(result.wish.delivered?.note).toBe('做完了')
    expect(result.wish.delivered?.at).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })
})

describe('cheerWish', () => {
  it('想要的人多一个，且不改原对象', () => {
    const wish = makeWish({ cheers: 7 })
    expect(cheerWish(wish).cheers).toBe(8)
    expect(wish.cheers).toBe(7)
  })
})

describe('validateWishDraft', () => {
  it('拦住空标题、过短描述、缺署名与不安全链接', () => {
    const codes = validateWishDraft({ title: '  ', brief: '太短', wisherName: '', wisherHandle: '', url: 'javascript:alert(1)' }).map(
      (issue) => issue.code,
    )
    expect(codes).toContain('empty-title')
    expect(codes).toContain('short-brief')
    expect(codes).toContain('missing-wisher')
    expect(codes).toContain('unsafe-link')
  })

  it('接受一份完整的愿望', () => {
    expect(
      validateWishDraft({
        title: '想要一个自动整理划线的东西',
        brief: '把阅读器里的划线自动整理成卡片，按主题分组，最好能导出。',
        wisherName: '小满',
        wisherHandle: 'xiaoman',
        url: 'https://example.com/x',
      }),
    ).toEqual([])
  })
})

describe('applyPatch（本地改动叠加到种子之上）', () => {
  const seeds = [makeWish(), makeWish({ id: 'w2', slug: 'w-two', title: '想要一个地铁换乘比较器', status: 'open' })]

  it('新建的愿望排在最前，且标记为本地来源', () => {
    const patch = { ...emptyPatch(), created: [makeWish({ id: 'local-1', slug: 'local-one', title: '我自己贴的', provenance: { source: 'local' } })] }
    const merged = applyPatch(seeds, patch)
    expect(merged[0].slug).toBe('local-one')
    expect(merged).toHaveLength(3)
  })

  it('把接单、交付与想要数叠加到对应愿望上', () => {
    const patch = {
      ...emptyPatch(),
      claims: { w1: { maker: { name: '阿岛', handle: 'a-dao' }, note: '我来', claimedAt: '2026-09-10' } },
      deliveries: { w2: { at: '2026-09-11', projectSlug: 'neon-kanban' } },
      cheers: { w1: 2 },
    }
    const merged = applyPatch(seeds, patch)
    const first = merged.find((wish) => wish.id === 'w1')!
    const second = merged.find((wish) => wish.id === 'w2')!
    expect(first.status).toBe('claimed')
    expect(first.claim?.maker.handle).toBe('a-dao')
    expect(first.cheers).toBe(5)
    expect(second.status).toBe('delivered')
    expect(second.delivered?.projectSlug).toBe('neon-kanban')
  })

  it('忽略指向不存在愿望的改动', () => {
    const patch = { ...emptyPatch(), cheers: { ghost: 5 } }
    expect(applyPatch(seeds, patch)).toHaveLength(2)
  })
})

describe('filterWishes / sortWishes / wishStats', () => {
  const wishes = [
    makeWish({ id: 'a', slug: 'a', createdAt: '2026-09-05', cheers: 10 }),
    makeWish({ id: 'b', slug: 'b', title: '想要一个恐龙分类互动图', category: 'education', createdAt: '2026-09-09', cheers: 1, tags: ['教学'] }),
    makeWish({ id: 'c', slug: 'c', title: '想要一个跑步轨迹画', status: 'claimed', createdAt: '2026-09-07', cheers: 5 }),
    makeWish({ id: 'd', slug: 'd', title: '想要一个家族树', status: 'delivered', createdAt: '2026-09-02', cheers: 2 }),
  ]

  it('按状态、分类与关键词筛选', () => {
    expect(filterWishes(wishes, { statuses: ['open'] }).map((wish) => wish.slug)).toEqual(['a', 'b'])
    expect(filterWishes(wishes, { categories: ['education'] }).map((wish) => wish.slug)).toEqual(['b'])
    expect(filterWishes(wishes, { query: '恐龙' }).map((wish) => wish.slug)).toEqual(['b'])
    expect(filterWishes(wishes, { query: '小满' }).map((wish) => wish.slug)).toEqual(['a', 'b', 'c', 'd'])
    expect(filterWishes(wishes, { statuses: ['open'], categories: ['education'] }).map((wish) => wish.slug)).toEqual(['b'])
  })

  it('支持最新、最想要、待接单优先三种排序', () => {
    expect(sortWishes(wishes, 'newest').map((wish) => wish.slug)).toEqual(['b', 'c', 'a', 'd'])
    expect(sortWishes(wishes, 'cheers').map((wish) => wish.slug)).toEqual(['a', 'c', 'd', 'b'])
    expect(sortWishes(wishes, 'open-first').map((wish) => wish.slug)).toEqual(['b', 'a', 'c', 'd'])
  })

  it('统计各类状态的数量', () => {
    expect(wishStats(wishes)).toEqual({ total: 4, open: 2, claimed: 1, delivered: 1 })
  })
})

describe('exportWishes', () => {
  it('导出可读 JSON，包含版本与时间戳', () => {
    const json = JSON.parse(exportWishes([makeWish()], '2026-09-22T00:00:00.000Z'))
    expect(json.schema).toBe('vibe-hall.wishes.v1')
    expect(json.exportedAt).toBe('2026-09-22T00:00:00.000Z')
    expect(json.count).toBe(1)
    expect(json.wishes[0].title).toContain('想要一个')
  })
})
