import { describe, expect, it } from 'vitest'
import { createUiPrefs, defaultSidebarOpen } from './uiPrefs'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set('vibe-hall:ui', initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    raw: () => map.get('vibe-hall:ui') ?? null,
  }
}

describe('defaultSidebarOpen', () => {
  it('宽屏默认展开，窄屏默认收起', () => {
    expect(defaultSidebarOpen(1440)).toBe(true)
    expect(defaultSidebarOpen(1024)).toBe(true)
    expect(defaultSidebarOpen(820)).toBe(false)
    expect(defaultSidebarOpen(360)).toBe(false)
  })
})

describe('createUiPrefs', () => {
  it('没有存储时按宽度给默认值', () => {
    expect(createUiPrefs({ storage: memoryStorage(), width: 1440 }).getOpen()).toBe(true)
    expect(createUiPrefs({ storage: memoryStorage(), width: 360 }).getOpen()).toBe(false)
  })

  it('用户的显式选择优先于默认值，并写入本机', () => {
    const storage = memoryStorage()
    const prefs = createUiPrefs({ storage, width: 1440 })
    prefs.setOpen(false)
    expect(prefs.getOpen()).toBe(false)
    expect(storage.raw()).toContain('false')

    const reopened = createUiPrefs({ storage, width: 1440 })
    expect(reopened.getOpen()).toBe(false)
  })

  it('toggle 会翻转并通知订阅者', () => {
    const prefs = createUiPrefs({ storage: memoryStorage(), width: 1440 })
    let calls = 0
    const off = prefs.subscribe(() => {
      calls += 1
    })
    prefs.toggle()
    expect(prefs.getOpen()).toBe(false)
    off()
    prefs.toggle()
    expect(calls).toBe(1)
  })

  it('存储损坏时回落到默认值而不是崩溃', () => {
    const prefs = createUiPrefs({ storage: memoryStorage('{坏掉'), width: 1440 })
    expect(prefs.getOpen()).toBe(true)
  })
})
