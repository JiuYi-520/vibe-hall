const STORAGE_KEY = 'vibe-hall:ui'

export interface UiPrefsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface UiPrefs {
  getOpen(): boolean
  setOpen(open: boolean): void
  toggle(): void
  subscribe(listener: () => void): () => void
}

/** 宽屏默认展开，窄屏默认收起（窄屏下它是抽屉，默认挡住内容不合适）。 */
export function defaultSidebarOpen(width: number): boolean {
  return width >= 1024
}

interface StoredPrefs {
  sidebarOpen?: boolean
}

/**
 * 侧边栏显示状态：用户显式选择优先于按宽度的默认值，并落本机存储。
 */
export function createUiPrefs({
  storage,
  width,
  key = STORAGE_KEY,
}: {
  storage?: UiPrefsStorage
  width: number
  key?: string
}): UiPrefs {
  const listeners = new Set<() => void>()
  let open = defaultSidebarOpen(width)

  try {
    const raw = storage?.getItem(key) ?? null
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const candidate = parsed as StoredPrefs | null
      if (candidate && typeof candidate.sidebarOpen === 'boolean') open = candidate.sidebarOpen
    }
  } catch {
    open = defaultSidebarOpen(width)
  }

  const persist = () => {
    try {
      storage?.setItem(key, JSON.stringify({ sidebarOpen: open }))
    } catch {
      // 写入失败时内存里仍然生效
    }
    for (const listener of listeners) listener()
  }

  return {
    getOpen: () => open,
    setOpen(next) {
      if (next === open) return
      open = next
      persist()
    },
    toggle() {
      open = !open
      persist()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
