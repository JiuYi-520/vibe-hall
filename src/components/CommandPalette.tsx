import { useEffect, useMemo, useRef, useState } from 'react'
import { filterPaletteItems, PALETTE_KIND_LABEL, type PaletteItem, type PaletteKind } from '../lib/paletteItems'
import { Highlighted } from './Highlighted'

interface CommandPaletteProps {
  open: boolean
  /** 全站可跳转条目：页面 + 展品 + 愿望 + 帖子。 */
  items: PaletteItem[]
  onClose: () => void
  onSelect: (id: string) => void
}

const HINTS = [
  { keys: '↑ ↓', label: '选择' },
  { keys: '↵', label: '打开' },
  { keys: 'esc', label: '关闭' },
]

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

const GROUP_ORDER: PaletteKind[] = ['page', 'project', 'wish', 'post']

export function CommandPalette({ open, items, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const results = useMemo(() => filterPaletteItems(items, query), [items, query])

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

  const commit = (id: string | undefined) => {
    if (!id) return
    onSelect(id)
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
      commit(results[cursor]?.id)
    }
  }

  if (!open) return null

  const grouped = query.trim() === ''
  let index = -1

  const renderItem = (item: PaletteItem) => {
    index += 1
    const active = index === cursor
    const position = index
    return (
      <button
        key={item.id}
        type="button"
        role="option"
        aria-selected={active}
        data-active={active}
        data-item={item.id}
        className={`palette__item ${active ? 'palette__item--active' : ''}`}
        onMouseEnter={() => setCursor(position)}
        onClick={() => commit(item.id)}
      >
        <span className="palette__glyph" style={{ ['--hue-a' as string]: item.hue, ['--hue-b' as string]: (item.hue + 48) % 360 }} aria-hidden="true">
          {item.kind === 'page' ? '⇥' : item.kind === 'wish' ? '✎' : item.kind === 'post' ? '💬' : '◆'}
        </span>
        <span className="palette__text">
          <strong>
            <Highlighted text={item.label} query={query} />
          </strong>
          <em>{item.sub}</em>
        </span>
        <span className="palette__meta">{item.badge}</span>
      </button>
    )
  }

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="快速跳转" onKeyDown={onKeyDown}>
      <div className="palette__scrim" onClick={onClose} aria-hidden="true" />
      <div className="palette__panel" ref={panelRef}>
        <div className="palette__field">
          <span aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            value={query}
            aria-label="搜索页面、作品、愿望或帖子"
            placeholder="搜索页面、作品、愿望、帖子…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="palette__count">{results.length}</span>
        </div>

        <div className="palette__list" ref={listRef}>
          {grouped ? (
            GROUP_ORDER.map((kind) => {
              const group = results.filter((item) => item.kind === kind)
              if (group.length === 0) return null
              return (
                <section key={kind} className="palette__group" aria-label={`${PALETTE_KIND_LABEL[kind]}结果`}>
                  <h3 className="palette__group-title">{PALETTE_KIND_LABEL[kind]}</h3>
                  {group.map(renderItem)}
                </section>
              )
            })
          ) : (
            <ul className="palette__flat" role="listbox" aria-label="搜索结果">
              {results.map((item) => (
                <li key={item.id}>{renderItem(item)}</li>
              ))}
            </ul>
          )}
          {results.length === 0 && <p className="palette__empty">没有找到匹配的内容，换个关键词试试。</p>}
        </div>

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
