export interface HighlightSegment {
  text: string
  match: boolean
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 把文本按查询词切成“命中 / 未命中”段，用于搜索结果高亮。
 * 未命中或空查询时返回单个未命中段，保证拼接后与原文本完全一致。
 */
export function splitHighlight(text: string, query: string): HighlightSegment[] {
  const terms = query
    .trim()
    .split(/[\s,，、]+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  if (terms.length === 0) return [{ text, match: false }]

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  const segments: HighlightSegment[] = []
  let cursor = 0

  for (const found of text.matchAll(pattern)) {
    const index = found.index ?? 0
    if (index > cursor) segments.push({ text: text.slice(cursor, index), match: false })
    segments.push({ text: found[0], match: true })
    cursor = index + found[0].length
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false })

  return segments.length > 0 ? segments : [{ text, match: false }]
}
