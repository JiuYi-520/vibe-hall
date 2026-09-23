import { NavLink, Link } from 'react-router-dom'
import { usePalette } from '../lib/paletteContext'
import type { ThemeName } from '../lib/hooks'

interface SiteHeaderProps {
  theme: ThemeName
  onToggleTheme: () => void
  count: number
}

export function SiteHeader({ theme, onToggleTheme, count }: SiteHeaderProps) {
  const palette = usePalette()

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="VIBE HALL 首页">
        <span className="brand__mark" aria-hidden="true">
          ◤
        </span>
        <span className="brand__text">
          <strong>VIBE HALL</strong>
          <em>vibecoding 作品展馆</em>
        </span>
      </Link>

      <nav className="site-nav" aria-label="站点导航">
        <NavLink to="/" end>
          展馆
        </NavLink>
        <NavLink to="/stars">升星榜</NavLink>
        <NavLink to="/wishes">愿望墙</NavLink>
        <NavLink to="/submit">提交作品</NavLink>
        <NavLink to="/about">关于</NavLink>
      </nav>

      <div className="site-actions">
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
