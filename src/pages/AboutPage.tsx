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
          <p>
            游戏、课件、看板、玩具、工具都可以。每件作品都有门牌号、分类、技术栈、
            一句介绍，以及最重要的两栏：关键提示词和迭代轨迹。
          </p>
        </section>
        <section className="about__card">
          <h2>数据从哪来</h2>
          <p>
            仓库内置一份示例目录用于展示交互；运行 <code>npm run fetch:github</code> 后会用公开
            GitHub 搜索快照生成 <code>src/data/github-live.json</code>，页面优先展示真实条目，
            并逐条标注来源与抓取时间。
          </p>
        </section>
        <section className="about__card">
          <h2>怎么做出来的</h2>
          <p>
            参考了 GitHub 上已有的几个展览项目：TheGallery 的“一间大厅、许多扇门”结构、
            soycodetrail/vibe-coding-gallery 的分类与标签导航、vibe-coding-party-gallery 的提交流程。
            展馆把它们的共同点收敛成：强分类 + 可分享筛选 + 作品叙事。
          </p>
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
