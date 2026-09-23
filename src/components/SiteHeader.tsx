import { Link } from 'react-router-dom'
import { usePalette } from '../lib/paletteContext'
import { useIdentity } from '../lib/identityStore'
import type { ThemeName } from '../lib/hooks'

interface SiteHeaderProps {
  theme: ThemeName
  onToggleTheme: () => void
  count: number
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function SiteHeader({ theme, onToggleTheme, count, sidebarOpen, onToggleSidebar }: SiteHeaderProps) {
  const palette = usePalette()
  const profile = useIdentity()

  return (
    <header className="site-header">
      <button
        type="button"
        className="icon-btn sidebar-toggle"
        onClick={onToggleSidebar}
        aria-expanded={sidebarOpen}
        aria-controls="site-sidebar"
        aria-label={sidebarOpen ? '隐藏侧边栏' : '显示侧边栏'}
        title="显示 / 隐藏侧边栏（快捷键 [）"
      >
        ☰
      </button>
      <Link className="brand" to="/" aria-label="VIBE HALL 首页">
        <span className="brand__mark" aria-hidden="true">
          ◤
        </span>
        <span className="brand__text">
          <strong>VIBE HALL</strong>
          <em>vibecoding 作品展馆</em>
        </span>
      </Link>

      <div className="site-actions">
        <Link className="me-chip" to="/me" aria-label={profile ? `我的主页：${profile.nickname}` : '设置本机身份'}>
          <span className="me-chip__dot" aria-hidden="true" style={{ ['--hue-a' as string]: profile?.hue ?? 212 }}>
            {(profile?.nickname || '本').slice(0, 1)}
          </span>
          <span className="me-chip__text">{profile ? profile.nickname : '本机身份'}</span>
        </Link>
        <button
          type="button"
          className="cmd-trigger"
          onClick={palette.open}
          aria-haspopup="dialog"
          aria-expanded={palette.isOpen}
        >
          <span aria-hidden="true">⌘</span>
          <span className="cmd-trigger__label">快速跳转</span>
          <kbd>K</kbd>
        </button>
        <span className="hall-count" title="馆内展品数">
          {count} 件
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
      </div>
    </header>
  )
}
