import { useMemo, useState } from 'react'
import type { StarSnapshot, StarWindow } from '../data/starTypes'
import { projectTrend } from '../data/analytics'

export function RepoTrend({ repo, history, window }: { repo: string; history: StarSnapshot[]; window: StarWindow }) {
  const [metric, setMetric] = useState<'stars' | 'forks'>('stars')
  const points = useMemo(() => projectTrend(history, repo, window), [history, repo, window])
  const values = points.map((point) => point[metric]).filter((value): value is number => typeof value === 'number')
  const change = values.length >= 2 ? values.at(-1)! - values[0] : null
  const max = Math.max(1, ...values)
  const path = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${100 - (value / max) * 86}`).join(' ')
  return <section className="repo-trend" aria-label="项目趋势">
    <div className="repo-trend__head"><div><span className="eyebrow">真实采集数据</span><h2>项目趋势</h2></div>
      <div className="segmented" role="group" aria-label="趋势指标"><button type="button" className={metric === 'stars' ? 'is-active' : ''} onClick={() => setMetric('stars')}>Star</button><button type="button" className={metric === 'forks' ? 'is-active' : ''} onClick={() => setMetric('forks')}>Fork</button></div></div>
    {values.length < 2 ? <p className="repo-trend__empty">历史不足：当前窗口只有 {values.length} 个可用采集点，暂不计算增长。</p> : <>
      <div className="repo-trend__chart"><svg role="img" aria-label={metric === 'stars' ? '星标趋势' : 'Fork 趋势'} viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><strong data-testid="trend-change">{change! >= 0 ? '+' : ''}{change}</strong></div>
      <small>窗口内 {points[0].at.slice(0, 10)} → {points.at(-1)!.at.slice(0, 10)} · <span>原始采集记录</span> {values.length} 次</small>
    </>}
  </section>
}
