import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Project } from '../data/types'
import type { RepoKind, StarMode, StarSnapshot, StarWindow } from '../data/starTypes'
import { KIND_LABEL, STAR_MODE_LABEL, STAR_WINDOW_META } from '../data/starTypes'
import { buildStarBoard, kindCounts } from '../data/stars'
import { starHistory } from '../data/history'
import { loadProjects } from '../data/loadProjects'
import { formatCompact } from '../lib/format'

interface StarsPageProps {
  projects?: Project[]
  history?: StarSnapshot[]
}

const bundle = loadProjects()
const MODES: StarMode[] = ['gain', 'rate', 'total']

function shortDate(iso?: string): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—'
}

export function StarsPage({ projects = bundle.projects, history = starHistory }: StarsPageProps) {
  const [window, setWindow] = useState<StarWindow>('30d')
  const [kind, setKind] = useState<RepoKind | 'all'>('all')
  const [mode, setMode] = useState<StarMode | null>(null)

  const gainBoard = useMemo(
    () => buildStarBoard({ projects, history, window, kind, mode: 'gain' }),
    [projects, history, window, kind],
  )
  const maxGain = gainBoard.rows.reduce((max, row) => Math.max(max, row.gain ?? 0), 0)
  /** 没增量就自动退到增速榜，不让空榜当成结果。 */
  const autoMode: StarMode = gainBoard.hasGain && maxGain > 0 ? 'gain' : 'rate'
  const effectiveMode: StarMode = mode ?? autoMode
  const board = useMemo(
    () => buildStarBoard({ projects, history, window, kind, mode: effectiveMode }),
    [projects, history, window, kind, effectiveMode],
  )
  const counts = useMemo(() => kindCounts(projects), [projects])
  const allGainZero = gainBoard.hasGain && maxGain === 0

  return (
    <div className="section stars">
      <header className="stars__head">
        <h1>GitHub 升星榜</h1>
        <p className="stars__lead">
          公开仓库按真实快照统计。每次 <code>npm run fetch:github</code> 追加一次快照，两次以上才能算「升了多少」。
        </p>
      </header>

      <div className="stars__meta">
        <span>
          快照 <strong>{board.totalSnapshots}</strong> 次
        </span>
        <span>
          窗口内 <strong>{board.snapshotCount}</strong> 次
        </span>
        <span>最新 {shortDate(board.latest)}</span>
        <span>仓库 {board.rows.length} 个</span>
      </div>

      <div className="stars__controls">
        <div className="segmented" role="group" aria-label="榜单类型">
          {MODES.map((item) => (
            <button
              key={item}
              type="button"
              className={effectiveMode === item ? 'is-active' : ''}
              aria-pressed={effectiveMode === item}
              disabled={item === 'gain' && !gainBoard.hasGain}
              onClick={() => setMode(item)}
            >
              {STAR_MODE_LABEL[item]}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="统计窗口">
          {STAR_WINDOW_META.map((item) => (
            <button
              key={item.id}
              type="button"
              className={window === item.id ? 'is-active' : ''}
              aria-pressed={window === item.id}
              onClick={() => setWindow(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filters__group stars__kinds" role="group" aria-label="按类型筛选">
        <button
          type="button"
          className={`pill pill--mini ${kind === 'all' ? 'pill--active' : ''}`}
          aria-pressed={kind === 'all'}
          onClick={() => setKind('all')}
        >
          全部
          <em>{projects.filter((project) => project.provenance.source === 'github').length}</em>
        </button>
        {counts.map((item) => (
          <button
            key={item.kind}
            type="button"
            className={`pill pill--mini ${kind === item.kind ? 'pill--active' : ''}`}
            aria-pressed={kind === item.kind}
            onClick={() => setKind(item.kind)}
          >
            {KIND_LABEL[item.kind]}
            <em>{item.count}</em>
          </button>
        ))}
      </div>

      {!gainBoard.hasGain && (
        <p className="stars__note">
          {board.totalSnapshots < 2
            ? `需要至少两次快照才能算增量：目前只有 ${board.totalSnapshots} 次。`
            : `窗口内快照不足两次（当前窗口内 ${board.snapshotCount} 次），把窗口换成「月」或「全部」即可看到增量。`}
        </p>
      )}
      {allGainZero && (
        <p className="stars__note">
          两次快照相隔很短，窗口内所有仓库增量为 0；等下一次抓取间隔足够长，这一列才会有数字。
        </p>
      )}

      {board.rows.length > 0 ? (
        <div className="stars__table-wrap">
          <table className="stars__table">
            <caption className="sr-only">GitHub 升星榜（{STAR_MODE_LABEL[effectiveMode]} · {STAR_WINDOW_META.find((item) => item.id === window)?.label}）</caption>
            <thead>
              <tr>
                <th scope="col">名次</th>
                <th scope="col">仓库</th>
                <th scope="col">分类</th>
                <th scope="col">星标</th>
                <th scope="col">增量</th>
                <th scope="col">日均</th>
                <th scope="col">最近更新</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row, index) => (
                <tr key={row.fullName} data-testid={`star-row-${row.fullName}`}>
                  <td className="stars__rank">{index + 1}</td>
                  <td className="stars__repo">
                    <a href={row.url} target="_blank" rel="noreferrer noopener">
                      {row.avatarUrl && <img src={row.avatarUrl} alt="" width={20} height={20} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
                      <span>
                        <strong>{row.fullName}</strong>
                        <em>{row.description.slice(0, 70)}</em>
                      </span>
                    </a>
                  </td>
                  <td>
                    <span className="chip chip--ghost">{KIND_LABEL[row.kind]}</span>
                  </td>
                  <td className="stars__num">{formatCompact(row.stars)}</td>
                  <td className="stars__num stars__gain">
                    {row.gain === null ? '—' : row.gain > 0 ? `+${formatCompact(row.gain)}` : String(row.gain)}
                  </td>
                  <td className="stars__num">{row.dailyRate}</td>
                  <td className="stars__num">{row.pushedAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty" data-testid="stars-empty">
          <p className="empty__glyph" aria-hidden="true">
            ◌
          </p>
          <h3>这个筛选下没有仓库</h3>
          <button type="button" className="btn btn--primary" onClick={() => setKind('all')}>
            看全部
          </button>
        </div>
      )}

      <p className="stars__foot">
        数据来自公开 GitHub 搜索快照，字段未改写；升星需要时间才能看出趋势。{' '}
        <Link to="/">回展馆</Link>
      </p>
    </div>
  )
}
