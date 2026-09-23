import { describe, expect, it } from 'vitest'
import { createInteractionBoard } from './interactionBoard'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set('vibe-hall:interactions', initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    raw: () => map.get('vibe-hall:interactions') ?? null,
  }
}

const ada = { name: 'Ada', handle: 'ada-standup', hue: 212 }

describe('createInteractionBoard', () => {
  it('默认没有任何本机互动', () => {
    const board = createInteractionBoard({ storage: memoryStorage() })
    expect(board.getState()).toEqual({ liked: {}, comments: [] })
  })

  it('点赞可切换，并落本机存储', () => {
    const storage = memoryStorage()
    const board = createInteractionBoard({ storage })
    board.toggleLike('neon-kanban')
    expect(board.getState().liked['neon-kanban']).toBe(true)
    board.toggleLike('neon-kanban')
    expect(board.getState().liked['neon-kanban']).toBe(false)
    expect(storage.raw()).toContain('neon-kanban')
  })

  it('发表评论：校验通过才写入，非法输入返回问题', () => {
    const board = createInteractionBoard({ storage: memoryStorage() })
    const bad = board.addComment('neon-kanban', ada, '   ')
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.issues.map((issue) => issue.code)).toContain('empty-body')
    expect(board.getState().comments).toHaveLength(0)

    const good = board.addComment('neon-kanban', ada, '这个拖拽手感很好。')
    expect(good.ok).toBe(true)
    expect(board.getState().comments).toHaveLength(1)
    expect(board.getState().comments[0].projectSlug).toBe('neon-kanban')
  })

  it('只能删除自己发的那条评论', () => {
    const board = createInteractionBoard({ storage: memoryStorage() })
    const added = board.addComment('neon-kanban', ada, '先收藏了。')
    if (!added.ok) throw new Error('should add')
    const id = added.comment.id

    expect(board.deleteComment(id, { nickname: '别人', handle: 'other' })).toBe(false)
    expect(board.getState().comments).toHaveLength(1)

    expect(board.deleteComment(id, { nickname: 'Ada', handle: 'ada-standup' })).toBe(true)
    expect(board.getState().comments).toHaveLength(0)
  })

  it('重开后本机点赞与评论仍在，损坏存储回落不崩', () => {
    const storage = memoryStorage()
    const first = createInteractionBoard({ storage })
    first.toggleLike('pixel-farm')
    first.addComment('pixel-farm', ada, '这个像素风格我喜欢。')

    const reopened = createInteractionBoard({ storage })
    expect(reopened.getState().liked['pixel-farm']).toBe(true)
    expect(reopened.getState().comments).toHaveLength(1)

    const broken = createInteractionBoard({ storage: memoryStorage('{坏掉') })
    expect(broken.getState()).toEqual({ liked: {}, comments: [] })
  })

  it('重置清掉本机互动', () => {
    const storage = memoryStorage()
    const board = createInteractionBoard({ storage })
    board.toggleLike('pixel-farm')
    board.reset()
    expect(board.getState().liked).toEqual({})
    expect(storage.raw()).toBeNull()
  })
})
