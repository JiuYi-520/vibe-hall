import { describe, expect, it } from 'vitest'
import { createWishBoard } from './wishBoard'
import type { Wish } from '../data/wishTypes'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set('vibe-hall:wishes', initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    raw: () => map.get('vibe-hall:wishes') ?? null,
  }
}

const seed: Wish = {
  id: 'seed-1',
  slug: 'seed-one',
  title: '想要一个自动整理划线的东西',
  brief: '把阅读器里的划线自动整理成卡片，按主题分组。',
  category: 'tool',
  tags: ['阅读'],
  wisher: { name: '小满', handle: 'xiaoman' },
  createdAt: '2026-09-01',
  status: 'open',
  cheers: 1,
  provenance: { source: 'seed' },
}

describe('createWishBoard', () => {
  it('新建愿望会置顶、标记本地来源并写入存储', () => {
    const storage = memoryStorage()
    const board = createWishBoard({ seeds: [seed], storage })
    const result = board.createWish({
      title: '想要一个会提醒我浇花的页面',
      brief: '按植物分别设置周期，到点提醒，支持打卡记录。',
      wisherName: 'Ken',
      wisherHandle: 'ken',
      category: 'life',
      tags: '生活, 提醒',
    })
    expect(result.ok).toBe(true)
    expect(board.getState().wishes[0].title).toContain('浇花')
    expect(board.getState().wishes[0].provenance.source).toBe('local')
    expect(storage.raw()).toContain('浇花')
  })

  it('拒绝不合法的愿望并给出问题列表', () => {
    const board = createWishBoard({ seeds: [seed], storage: memoryStorage() })
    const result = board.createWish({ title: '', brief: '短', wisherName: '', wisherHandle: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.code)).toContain('empty-title')
    expect(board.getState().wishes).toHaveLength(1)
  })

  it('接单、交付、想要都会落到状态与存储里，重新打开仍然生效', () => {
    const storage = memoryStorage()
    const first = createWishBoard({ seeds: [seed], storage })
    expect(first.claim('seed-1', { name: '阿岛', handle: 'a-dao' }, '我来做').ok).toBe(true)
    first.cheer('seed-1')
    expect(first.deliver('seed-1', 'a-dao', { projectSlug: 'neon-kanban' }).ok).toBe(true)

    const reopened = createWishBoard({ seeds: [seed], storage })
    const wish = reopened.getState().wishes[0]
    expect(wish.status).toBe('delivered')
    expect(wish.cheers).toBe(2)
    expect(wish.delivered?.projectSlug).toBe('neon-kanban')
  })

  it('存储内容损坏时回落到空改动而不是崩溃', () => {
    const board = createWishBoard({ seeds: [seed], storage: memoryStorage('{坏掉的 JSON') })
    expect(board.getState().wishes).toHaveLength(1)
    expect(board.getState().wishes[0].status).toBe('open')
  })

  it('重置会清掉本地改动并恢复种子', () => {
    const storage = memoryStorage()
    const board = createWishBoard({ seeds: [seed], storage })
    board.cheer('seed-1')
    expect(board.getState().wishes[0].cheers).toBe(2)
    board.reset()
    expect(board.getState().wishes[0].cheers).toBe(1)
    expect(storage.raw()).toBeNull()
  })

  it('通知订阅者状态变化', () => {
    const board = createWishBoard({ seeds: [seed], storage: memoryStorage() })
    let calls = 0
    const unsubscribe = board.subscribe(() => {
      calls += 1
    })
    board.cheer('seed-1')
    unsubscribe()
    board.cheer('seed-1')
    expect(calls).toBe(1)
  })

  it('本机贴的愿望同样能被接单和交付', () => {
    const board = createWishBoard({ seeds: [seed], storage: memoryStorage() })
    const created = board.createWish({
      title: '想要一个替我浇花的页面',
      brief: '按植物分别设置周期，到点提醒我，能打卡记录。',
      wisherName: 'Ken',
      wisherHandle: 'ken',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const id = created.wish.id

    expect(board.claim(id, { name: '阿岛', handle: 'a-dao' }, '我来做').ok).toBe(true)
    expect(board.getState().wishes.find((wish) => wish.id === id)?.status).toBe('claimed')

    expect(board.deliver(id, 'a-dao', { projectSlug: 'neon-kanban' }).ok).toBe(true)
    const delivered = board.getState().wishes.find((wish) => wish.id === id)
    expect(delivered?.status).toBe('delivered')
    expect(delivered?.delivered?.projectSlug).toBe('neon-kanban')
  })

  it('本机贴的愿望也能被“我也想要”加一', () => {
    const board = createWishBoard({ seeds: [seed], storage: memoryStorage() })
    const created = board.createWish({
      title: '想要一个晾衣提醒看板',
      brief: '每天早上看一眼今天能不能晾衣服、几点最合适。',
      wisherName: 'Ken',
      wisherHandle: 'ken',
    })
    if (!created.ok) return
    board.cheer(created.wish.id)
    expect(board.getState().wishes.find((wish) => wish.id === created.wish.id)?.cheers).toBe(1)
  })

  it('“我也想要”可以取消：再点一次回到原值，重开仍记得', () => {
    const storage = memoryStorage()
    const board = createWishBoard({ seeds: [seed], storage })
    expect(board.isCheered('seed-1')).toBe(false)

    board.toggleCheer('seed-1')
    expect(board.isCheered('seed-1')).toBe(true)
    expect(board.getState().wishes[0].cheers).toBe(2)

    const reopened = createWishBoard({ seeds: [seed], storage })
    expect(reopened.isCheered('seed-1')).toBe(true)
    expect(reopened.getState().wishes[0].cheers).toBe(2)

    reopened.toggleCheer('seed-1')
    expect(reopened.isCheered('seed-1')).toBe(false)
    expect(reopened.getState().wishes[0].cheers).toBe(1)
  })
})
