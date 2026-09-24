/** 仓库类型：技能包 / 软件应用 / 库与框架 / 清单合集 / 其它。 */
export type RepoKind = 'skill' | 'app' | 'library' | 'list' | 'other'

export type StarWindow = '1d' | '7d' | '30d' | 'all'

export type StarMode = 'gain' | 'rate' | 'total'

/** 一次真实抓取的星标快照：只有两次以上快照才能算出「升了多少」。 */
export interface StarSnapshot {
  at: string
  repos: Record<string, number>
  forks?: Record<string, number>
  languages?: Record<string, string | null>
}

export interface StarRow {
  fullName: string
  title: string
  owner: string
  avatarUrl?: string
  url: string
  description: string
  kind: RepoKind
  stars: number
  /** 窗口内增量；快照不足或该仓库不在老快照里时为 null。 */
  gain: number | null
  /** 创建至今的平均每天星标（真实可算，不依赖历史快照）。 */
  dailyRate: number
  createdAt: string
  pushedAt?: string
}

export interface StarBoard {
  rows: StarRow[]
  mode: StarMode
  /** 参与本次统计（落在窗口内）的快照数量。 */
  snapshotCount: number
  totalSnapshots: number
  earliest?: string
  latest?: string
  /** 是否有真实的窗口增量可展示。 */
  hasGain: boolean
}

export const KIND_LABEL: Record<RepoKind, string> = {
  skill: '技能包',
  app: '软件应用',
  library: '库与框架',
  list: '清单合集',
  other: '其它',
}

export const KIND_ORDER: RepoKind[] = ['skill', 'app', 'library', 'list', 'other']

export const STAR_MODE_LABEL: Record<StarMode, string> = {
  gain: '增量榜',
  rate: '增速榜（生涯日均）',
  total: '存量榜',
}

export const STAR_WINDOW_META: { id: StarWindow; label: string; days: number | null }[] = [
  { id: '1d', label: '日', days: 1 },
  { id: '7d', label: '周', days: 7 },
  { id: '30d', label: '月', days: 30 },
  { id: 'all', label: '全部', days: null },
]
