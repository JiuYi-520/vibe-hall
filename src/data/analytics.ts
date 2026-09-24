import type { StarSnapshot, StarWindow } from './starTypes'
import { STAR_WINDOW_META } from './starTypes'

const validCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

export function normalizeSnapshots(input: unknown, now = Date.now()): StarSnapshot[] {
  if (!Array.isArray(input)) return []
  const result = new Map<number, StarSnapshot>()
  for (const entry of input) {
    if (!entry || typeof entry.at !== 'string' || !entry.repos || typeof entry.repos !== 'object' || Array.isArray(entry.repos)) continue
    const time = Date.parse(entry.at)
    if (!Number.isFinite(time) || time > now || !Object.values(entry.repos).every(validCount)) continue
    const counts = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter(([, count]) => validCount(count))) as Record<string, number> : undefined
    const languages = entry.languages && typeof entry.languages === 'object' && !Array.isArray(entry.languages)
      ? Object.fromEntries(Object.entries(entry.languages).filter(([, value]) => value === null || typeof value === 'string')) as Record<string, string | null> : undefined
    result.set(time, { at: entry.at, repos: entry.repos, forks: counts(entry.forks), languages })
  }
  return [...result.entries()].sort(([a], [b]) => a - b).map(([, snapshot]) => snapshot)
}

export function windowSnapshots(history: StarSnapshot[], window: StarWindow): StarSnapshot[] {
  const snapshots = normalizeSnapshots(history)
  const latest = snapshots.at(-1)
  const days = STAR_WINDOW_META.find((item) => item.id === window)?.days
  if (!latest || days == null) return snapshots
  const cutoff = Date.parse(latest.at) - days * 86_400_000
  return snapshots.filter((item) => Date.parse(item.at) >= cutoff)
}

export function projectTrend(history: StarSnapshot[], repo: string, window: StarWindow) {
  return windowSnapshots(history, window).filter((item) => validCount(item.repos[repo]))
    .map((item) => ({ at: item.at, stars: item.repos[repo], forks: item.forks?.[repo] ?? null }))
}

export function buildLanguageStats(history: StarSnapshot[], repos: string[], window: StarWindow) {
  const snapshots = windowSnapshots(history, window)
  const latest = snapshots.at(-1)
  if (!latest) return []
  const base = snapshots.length > 1 ? snapshots[0] : undefined
  const groups = new Map<string, { language: string; repos: number; stars: number; forks: number | null;
    starGain: number | null; forkGain: number | null; starCompared: number; forkCompared: number; forkKnown: number }>()
  for (const repo of new Set(repos)) {
    if (!validCount(latest.repos[repo])) continue
    const language = latest.languages?.[repo] || '未标注'
    const row = groups.get(language) ?? { language, repos: 0, stars: 0, forks: 0, starGain: null,
      forkGain: null, starCompared: 0, forkCompared: 0, forkKnown: 0 }
    row.repos++
    row.stars += latest.repos[repo]
    const forks = latest.forks?.[repo]
    if (validCount(forks)) { row.forks = (row.forks ?? 0) + forks; row.forkKnown++ }
    if (base && validCount(base.repos[repo])) {
      row.starGain = (row.starGain ?? 0) + latest.repos[repo] - base.repos[repo]
      row.starCompared++
    }
    const oldForks = base?.forks?.[repo]
    if (validCount(forks) && validCount(oldForks)) {
      row.forkGain = (row.forkGain ?? 0) + forks - oldForks
      row.forkCompared++
    }
    groups.set(language, row)
  }
  return [...groups.values()].map((row) => ({ ...row, forks: row.forkKnown === row.repos ? row.forks : null }))
    .sort((a, b) => b.stars - a.stars || a.language.localeCompare(b.language))
}
