import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { loadProjects } from './data/loadProjects'
import { useShortcuts, useTheme } from './lib/hooks'
import { PaletteContext } from './lib/paletteContext'
import { CommandPalette } from './components/CommandPalette'
import { SiteHeader } from './components/SiteHeader'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { buildPaletteItems } from './lib/paletteItems'
import type { Wish } from './data/wishTypes'
import type { ForumPost } from './data/forumTypes'

// 详情/提交/关于三个页面按需加载：首屏只下载展馆本身需要的代码。
const ProjectPage = lazy(() => import('./pages/ProjectPage').then((module) => ({ default: module.ProjectPage })))
const SubmitPage = lazy(() => import('./pages/SubmitPage').then((module) => ({ default: module.SubmitPage })))
const AboutPage = lazy(() => import('./pages/AboutPage').then((module) => ({ default: module.AboutPage })))
const WishesPage = lazy(() => import('./pages/WishesPage').then((module) => ({ default: module.WishesPage })))
const StarsPage = lazy(() => import('./pages/StarsPage').then((module) => ({ default: module.StarsPage })))
const ForumPage = lazy(() => import('./pages/ForumPage').then((module) => ({ default: module.ForumPage })))
const MePage = lazy(() => import('./pages/MePage').then((module) => ({ default: module.MePage })))

function RouteFallback() {
  return (
    <div className="section">
      <p className="route-fallback" role="status">
        正在打开…
      </p>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

function Shell() {
  const bundle = useMemo(() => loadProjects(), [])
  const [theme, toggleTheme] = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const navigate = useNavigate()
  /**
   * 愿望与帖子的索引按需加载：不把两个存储层和它们的种子数据塞进首屏包，
   * 但打开面板后仍然会订阅更新。
   */
  const [index, setIndex] = useState<{ wishes: Wish[]; posts: ForumPost[] }>({ wishes: [], posts: [] })

  useEffect(() => {
    if (!paletteOpen) return
    let cancelled = false
    let stop: (() => void) | undefined

    void (async () => {
      const [{ wishBoard }, { forumBoard }] = await Promise.all([import('./lib/wishBoard'), import('./lib/forumBoard')])
      if (cancelled) return
      const sync = () => setIndex({ wishes: wishBoard.getState().wishes, posts: forumBoard.getState().posts })
      sync()
      const offWish = wishBoard.subscribe(sync)
      const offForum = forumBoard.subscribe(sync)
      stop = () => {
        offWish()
        offForum()
      }
    })()

    return () => {
      cancelled = true
      stop?.()
    }
  }, [paletteOpen])

  const paletteItems = useMemo(
    () => buildPaletteItems({ projects: bundle.projects, wishes: index.wishes, posts: index.posts }),
    [bundle.projects, index],
  )

  const paletteApi = useMemo(
    () => ({
      open: () => setPaletteOpen(true),
      close: () => setPaletteOpen(false),
      isOpen: paletteOpen,
    }),
    [paletteOpen],
  )

  const shortcuts = useMemo(
    () => ({
      onPalette: () => setPaletteOpen((current) => !current),
      onSearch: () => {
        const input = document.getElementById('hall-search')
        if (input instanceof HTMLInputElement) {
          input.scrollIntoView({ block: 'center' })
          input.focus()
          input.select()
        } else {
          navigate('/')
        }
      },
    }),
    [navigate],
  )
  useShortcuts(shortcuts)

  const onSelect = useCallback(
    (id: string) => {
      const [kind, ...rest] = id.split(':')
      const value = rest.join(':')
      if (kind === 'page') navigate(value)
      else if (kind === 'wish') navigate(`/wishes?focus=${encodeURIComponent(value)}`)
      else if (kind === 'post') navigate(`/forum?focus=${encodeURIComponent(value)}`)
      else navigate(`/p/${value}`)
    },
    [navigate],
  )

  /** 跳过导航链接同样不能触发 hash 路由跳转。 */
  const skipToHall = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const hall = document.getElementById('hall')
    hall?.scrollIntoView({ block: 'start' })
    hall?.focus?.()
  }, [])

  return (
    <PaletteContext.Provider value={paletteApi}>
      <a className="skip-link" href="#hall" onClick={skipToHall}>
        跳到展馆
      </a>
      <div className="aurora" aria-hidden="true">
        <span className="aurora__blob aurora__blob--a" />
        <span className="aurora__blob aurora__blob--b" />
        <span className="aurora__blob aurora__blob--c" />
        <span className="aurora__grid" />
        <span className="aurora__noise" />
      </div>
      <ScrollToTop />
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} count={bundle.projects.length} />
      <main className="site-main">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route
              path="/"
              element={
                <HomePage projects={bundle.projects} liveCount={bundle.liveCount} fetchedAt={bundle.fetchedAt ?? null} />
              }
            />
            <Route path="/p/:slug" element={<ProjectPage projects={bundle.projects} />} />
            <Route path="/submit" element={<SubmitPage />} />
            <Route path="/stars" element={<StarsPage />} />
            <Route path="/wishes" element={<WishesPage />} />
            <Route path="/forum" element={<ForumPage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="site-footer">
        <p>
          VIBE HALL v0.1 · 一个 vibecoding 作品展馆 ·{' '}
          <a href="https://github.com/topics/vibe-coding" target="_blank" rel="noreferrer noopener">
            GitHub 上的 vibe-coding ↗
          </a>
        </p>
        <p className="site-footer__note">
          示例数据仅用于展示交互；真实条目以“GitHub 实时”标记，并可追溯到对应仓库。
        </p>
      </footer>
      <CommandPalette open={paletteOpen} items={paletteItems} onClose={paletteApi.close} onSelect={onSelect} />
    </PaletteContext.Provider>
  )
}

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
