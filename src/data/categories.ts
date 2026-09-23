import type { CategoryId, ProjectStatus } from './types'

export interface CategoryMeta {
  id: CategoryId
  label: string
  glyph: string
  /** Two hue stops used for the card aura, so every door looks different. */
  hue: [number, number]
}

export const PROJECT_CATEGORIES: CategoryMeta[] = [
  { id: 'tool', label: '效率工具', glyph: '◆', hue: [212, 268] },
  { id: 'game', label: '游戏', glyph: '◈', hue: [318, 258] },
  { id: 'education', label: '教学课件', glyph: '❖', hue: [168, 208] },
  { id: 'visual', label: '创意视觉', glyph: '✳', hue: [26, 330] },
  { id: 'data', label: '数据看板', glyph: '▤', hue: [192, 232] },
  { id: 'ai', label: 'AI 应用', glyph: '✦', hue: [264, 196] },
  { id: 'life', label: '生活趣味', glyph: '◐', hue: [44, 12] },
  { id: 'sound', label: '声音实验', glyph: '◎', hue: [286, 218] },
]

export const CATEGORY_IDS: CategoryId[] = PROJECT_CATEGORIES.map((c) => c.id)

export const CATEGORY_LABEL: Record<CategoryId, string> = PROJECT_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.label }),
  {} as Record<CategoryId, string>,
)

export const STATUS_META: Record<ProjectStatus, { label: string; tone: string }> = {
  live: { label: '开放体验', tone: 'ok' },
  wip: { label: '迭代中', tone: 'warn' },
  archived: { label: '已归档', tone: 'mute' },
}

export function categoryMeta(id: CategoryId): CategoryMeta {
  return PROJECT_CATEGORIES.find((c) => c.id === id) ?? PROJECT_CATEGORIES[0]
}
