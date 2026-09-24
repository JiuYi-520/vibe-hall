import raw from './github-history.json'
import type { StarSnapshot } from './starTypes'
import { normalizeSnapshots } from './analytics'

interface HistoryFile {
  schema?: string
  snapshots?: StarSnapshot[]
}

const file = raw as HistoryFile

/** 真实星标快照历史；结构不合法的条目直接丢掉，不让坏数据进榜。 */
export const starHistory: StarSnapshot[] = normalizeSnapshots(file.snapshots)

export const starHistoryMeta = {
  total: starHistory.length,
  latest: starHistory[starHistory.length - 1]?.at ?? null,
  earliest: starHistory[0]?.at ?? null,
}
