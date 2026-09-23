import raw from './github-history.json'
import type { StarSnapshot } from './starTypes'

interface HistoryFile {
  schema?: string
  snapshots?: StarSnapshot[]
}

function isSnapshot(value: unknown): value is StarSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StarSnapshot>
  if (typeof candidate.at !== 'string' || !candidate.repos || typeof candidate.repos !== 'object') return false
  return Object.values(candidate.repos).every((stars) => typeof stars === 'number' && Number.isFinite(stars))
}

const file = raw as HistoryFile

/** 真实星标快照历史；结构不合法的条目直接丢掉，不让坏数据进榜。 */
export const starHistory: StarSnapshot[] = (Array.isArray(file.snapshots) ? file.snapshots : [])
  .filter(isSnapshot)
  .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

export const starHistoryMeta = {
  total: starHistory.length,
  latest: starHistory[starHistory.length - 1]?.at ?? null,
  earliest: starHistory[0]?.at ?? null,
}
