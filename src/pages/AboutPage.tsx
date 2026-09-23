import { Link } from 'react-router-dom'

export function AboutPage() {
  return (
    <div className="section about">
      <header className="about__head">
        <h1>关于这座展馆</h1>
        <p>
          VIBE HALL 是一个“作品展馆”，不是排行榜，也不是教程库。它想回答一个具体问题：
          <strong>不同的人用自然语言做出来的东西，看起来分别是什么样？</strong>
        </p>
      </header>

      <div className="about__grid">
        <section className="about__card">
          <h2>展什么</h2>
          <p>游戏、课件、看板、玩具都收。每件作品最重要的两栏是：关键提示词、迭代轨迹。</p>
        </section>
        <section className="about__card">
          <h2>数据从哪来</h2>
          <p><code>npm run fetch:github</code> 抓公开 GitHub 快照写入 <code>src/data/github-live.json</code>，并追加星标历史供升星榜使用；条目逐条标注来源与抓取时间。</p>
        </section>
        <section className="about__card">
          <h2>怎么做出来的</h2>
          <p>结构参考 TheGallery（一间大厅、许多扇门）、soycodetrail/vibe-coding-gallery（分类与标签导航）。</p>
        </section>
        <section className="about__card">
          <h2>键盘</h2>
          <ul className="about__keys">
            <li>
              <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> 打开快速跳转
            </li>
            <li>
              <kbd>/</kbd> 聚焦搜索框
            </li>
            <li>
              <kbd>↑</kbd> <kbd>↓</kbd> <kbd>↵</kbd> 在跳转面板里选择与打开
            </li>
            <li>
              <kbd>Esc</kbd> 关闭面板
            </li>
          </ul>
        </section>
        <section className="about__card">
          <h2>愿望墙是什么</h2>
          <p>贴出「我想要一个能…的东西」，别人接单，做完挂回大厅。没有后端，愿望只存在<strong>本机浏览器</strong>里，导出 JSON 可交给维护者收录。</p>
          <p>
            <Link to="/wishes">去愿望墙 →</Link>
          </p>
        </section>
      </div>

      <div className="about__foot">
        <Link className="btn btn--primary" to="/">
          回到展馆
        </Link>
        <Link className="btn btn--ghost" to="/submit">
          提交作品
        </Link>
      </div>
    </div>
  )
}
