import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useIdentity } from '../lib/identityStore'
import { useCredits } from '../lib/creditBoard'
import { summarize } from '../data/credits'

interface SiteSidebarProps {
  open: boolean
  /** 窄屏时它是抽屉：需要遮罩、Esc 关闭与焦点管理。 */
  narrow: boolean
  onClose: () => void
}

export const SIDEBAR_LINKS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: '展馆', end: true },
  { to: '/stars', label: '升星榜' },
  { to: '/wishes', label: '愿望墙' },
  { to: '/forum', label: '论坛' },
  { to: '/submit', label: '提交作品' },
  { to: '/about', label: '关于' },
]

export function SiteSidebar({ open, narrow, onClose }: SiteSidebarProps) {
  const profile = useIdentity()
  const credits = useCredits()
  const creditBalance = summarize(credits.entries).balance

  // 抽屉打开时：Esc 关闭。收起时整块 inert，里面的链接不会被 Tab 找到。
  useEffect(() => {
    if (!open || !narrow) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, narrow, onClose])

  return (
    <aside
      id="site-sidebar"
      className={`site-sidebar ${open ? 'is-open' : 'is-hidden'}`}
      aria-label="站点侧边栏"
      inert={!open}
    >
      <nav className="site-sidebar__nav" aria-label="主导航">
        {SIDEBAR_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className="site-sidebar__link">
            <span className="site-sidebar__mark" aria-hidden="true">
              ◇
            </span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="site-sidebar__me">
        {profile ? (
          <Link className="site-sidebar__me-card" to="/me">
            <span className="me-chip__dot" aria-hidden="true" style={{ ['--hue-a' as string]: profile.hue }}>
              {(profile.nickname || '本').slice(0, 1)}
            </span>
            <span>
              <strong>{profile.nickname}</strong>
              <em>{profile.handle ? `@${profile.handle}` : '本机身份'} · 积分 {creditBalance}</em>
            </span>
          </Link>
        ) : (
          <Link className="site-sidebar__me-card" to="/me">
            <span className="me-chip__dot" aria-hidden="true">
              本
            </span>
            <span>
              <strong>本机身份</strong>
              <em>设置后用于署名 · 积分 {creditBalance}</em>
            </span>
          </Link>
        )}
      </div>

      <button type="button" className="site-sidebar__hide" onClick={onClose}>
        <span aria-hidden="true">⟨</span> 隐藏侧边栏
      </button>
    </aside>
  )
}
