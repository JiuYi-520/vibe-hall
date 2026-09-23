import { useEffect, useMemo, useRef, useState } from 'react'
import type { Project } from '../data/types'
import { categoryMeta } from '../data/categories'
import { matchesQuery, rankProjects } from '../data/queries'
import { formatCompact } from '../lib/format'
import { Highlighted } from './Highlighted'

interface CommandPaletteProps {
  open: boolean
  projects: Project[]
  onClose: () => void
  onSelect: (slug: string) => void
}

const HINTS = [
  { keys: '↑ ↓', label: '选择' },
  { keys: '↵', label: '打开' },
  { keys: 'esc', label: '关闭' },
]

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function CommandPalette({ open, projects, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const results = useMemo(
    () => rankProjects(projects.filter((project) => matchesQuery(project, query)), query),
    [projects, query],
  )

  useEffect(() => {
    setCursor(0)
  }, [query, open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  /**
   * 打开时先记住来源焦点，再主动聚焦输入框（不能用 autoFocus：
   * 它会在提交阶段先抢走焦点，导致记下来的是面板自己）。
   * 关闭时把焦点还给来源元素；没有来源（例如按 ⌘K 打开）就还给头部触发按钮。
   */
  useEffect(() => {
    if (!open) return
    const active = document.activeElement
    const fallback = document.querySelector<HTMLElement>('.cmd-trigger')
    restoreRef.current = active instanceof HTMLElement && active !== document.body ? active : fallback
    inputRef.current?.focus()
    return () => {
      if (restoreRef.current?.isConnected) restoreRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [cursor, results])

  const commit = (slug: string | undefined) => {
    if (!slug) return
    onSelect(slug)
    onClose()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'Tab') {
      // 焦点陷阱：Tab 只在面板内循环，不会跑到背景页面。
      const nodes = panelRef.current ? [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)] : []
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      const inside = active ? (panelRef.current?.contains(active) ?? false) : false
      if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault()
        last.focus()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((current) => (results.length === 0 ? 0 : (current + 1) % results.length))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((current) => (results.length === 0 ? 0 : (current - 1 + results.length) % results.length))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(results[cursor]?.slug)
    }
  }

  if (!open) return null

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="快速跳转" onKeyDown={onKeyDown}>
      <div className="palette__scrim" onClick={onClose} aria-hidden="true" />
      <div className="palette__panel" ref={panelRef}>
        <div className="palette__field">
          <span aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            value={query}
            aria-label="搜索作品、作者或技术栈"
            placeholder="输入作品名、作者或技术栈…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="palette__count">{results.length}</span>
        </div>

        <ul className="palette__list" role="listbox" aria-label="搜索结果" ref={listRef}>
          {results.map((project, index) => {
            const meta = categoryMeta(project.category)
            const active = index === cursor
            return (
              <li key={project.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-active={active}
                  className={`palette__item ${active ? 'palette__item--active' : ''}`}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => commit(project.slug)}
                >
                  <span
                    className="palette__glyph"
                    style={{ ['--hue-a' as string]: meta.hue[0], ['--hue-b' as string]: meta.hue[1] }}
                    aria-hidden="true"
                  >
                    {meta.glyph}
                  </span>
                  <span className="palette__text">
                    <strong>
                      <Highlighted text={project.title} query={query} />
                    </strong>
                    <em>
                      {project.maker.name} · {project.stack.slice(0, 3).join(' / ')}
                    </em>
                  </span>
                  <span className="palette__meta">
                    {project.provenance.source === 'github' ? `★ ${formatCompact(project.stars ?? 0)}` : meta.label}
                  </span>
                </button>
              </li>
            )
          })}
          {results.length === 0 && <li className="palette__empty">没有找到匹配的作品，换个关键词试试。</li>}
        </ul>

        <div className="palette__hints">
          {HINTS.map((hint) => (
            <span key={hint.label}>
              <kbd>{hint.keys}</kbd>
              {hint.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
