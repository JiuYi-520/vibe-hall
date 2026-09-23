import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type ThemeName = 'dark' | 'light'

const THEME_KEY = 'vibe-hall:theme'

export function useTheme(): [ThemeName, () => void] {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = window.localStorage?.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
    try {
      window.localStorage?.setItem(THEME_KEY, theme)
    } catch {
      /* private mode: ignore */
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: ThemeName = current === 'dark' ? 'light' : 'dark'
      const apply = () => setTheme(next)
      const doc = document as Document & { startViewTransition?: (cb: () => void) => void }
      if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        doc.startViewTransition(() => apply())
        return current
      }
      return next
    })
  }, [])

  return [theme, toggle]
}

let reducedQuery: MediaQueryList | null = null
const reducedSubscribers = new Set<() => void>()

function getReducedQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  reducedQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)')
  return reducedQuery
}

function notifyReduced(): void {
  for (const subscriber of reducedSubscribers) subscriber()
}

function subscribeReducedMotion(callback: () => void): () => void {
  const query = getReducedQuery()
  if (!query) return () => {}
  reducedSubscribers.add(callback)
  if (reducedSubscribers.size === 1) query.addEventListener('change', notifyReduced)
  return () => {
    reducedSubscribers.delete(callback)
    if (reducedSubscribers.size === 0) query.removeEventListener('change', notifyReduced)
  }
}

function reducedSnapshot(): boolean {
  return getReducedQuery()?.matches ?? false
}

/**
 * 全站共享一个 matchMedia 订阅：几十张卡同时用也不会注册几十个监听器。
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, reducedSnapshot, () => false)
}

/** 全局快捷键：⌘K 打开快速跳转、/ 聚焦搜索、[ 收起或展开侧边栏。 */
export function useShortcuts(handlers: { onPalette: () => void; onSearch: () => void; onToggleSidebar: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        handlers.onPalette()
        return
      }
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        handlers.onSearch()
        return
      }
      if (event.key === '[' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        handlers.onToggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return progress
}

export function useCopy(): [string | null, (text: string, label: string) => Promise<void>] {
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const copy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setToast(`已复制${label}`)
    } catch {
      setToast('复制失败，请手动选择')
    }
  }, [])

  return [toast, copy]
}
