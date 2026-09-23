import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="section">
      <div className="empty notfound">
        <p className="empty__glyph" aria-hidden="true">
          ◌
        </p>
        <h1>页面不存在</h1>
        <p>链接可能已经变了，或者这件东西被移出了展馆。</p>
        <div className="notfound__links">
          <Link className="btn btn--primary" to="/">
            展开馆
          </Link>
          <Link className="btn btn--ghost" to="/wishes">
            愿望墙
          </Link>
          <Link className="btn btn--ghost" to="/forum">
            论坛
          </Link>
          <Link className="btn btn--ghost" to="/stars">
            升星榜
          </Link>
        </div>
      </div>
    </div>
  )
}
