# VIBE HALL · vibecoding 作品展馆（第一版）

一个用来陈列不同创作者的 vibecoding 作品的网站：门牌号、分类、技术栈、一句介绍，
再加上这个展馆最看重的两样东西 —— 关键提示词 和 迭代轨迹。

## 快速开始

```powershell
npm install
npm run dev            # 开发服务器 http://localhost:5173
npm run build          # 类型检查 + 生产构建（dist/）
npm run preview        # 预览构建产物 http://localhost:4173
npm test               # 36 项单元/组件测试
npm run fetch:github   # 拉取真实 GitHub 作品到 src/data/github-live.json
npm run verify:ui      # 用真实浏览器（Edge）跑 21 项运行时检查并截图
```

## 数据来源（重要）

展馆有两条数据通道，界面上严格区分，不会互相冒充：

| 通道 | 来源 | 卡片标记 | 字段 |
| --- | --- | --- | --- |
| 内置示例 | `src/data/seed.ts`，为展示交互而写 | 示例 | 完整故事、提示词、迭代记录 |
| GitHub 实时 | `npm run fetch:github` 生成的 `src/data/github-live.json` | GitHub 实时 | 仓库公开元数据：名称、简介原文、stars、topics、owner、链接 |

`loadProjects()` 合并两者，并用同一套 `validateProjects()` 丢弃结构不合法的实时记录。
GitHub 条目的 story 字段是仓库自述原文（带“仓库自述（原文）”前缀），展馆不替作者编造创作过程；
没有 demo 链接、没有提示词时，详情页只显示元数据与「数据说明」。

## 交互与可访问性

- `⌘K` / `Ctrl K` 打开快速跳转面板；`/` 聚焦搜索框；`↑ ↓ ↵ Esc` 在面板内导航。
- 筛选状态写进 URL（`#/?cats=game&sort=stars`），可直接分享或刷新还原。
- 卡片跟随指针做 3D 倾斜 + 光斑跟随；网格切换/排序走布局动画（FLIP）。
- 卡片、分类、排序、布局全部是真实按钮/链接，带 `aria-pressed`、`aria-live` 结果数。
- 尊重 `prefers-reduced-motion`：关闭倾斜、漂移、跑马灯与过渡；`prefers-color-scheme` 决定初始主题。

## 目录

```
src/
  data/        types / categories / seed / queries / validateProjects / loadProjects
  lib/         urlState（URL 状态解析与序列化）/ hooks（主题、快捷键、滚动进度、复制）
  components/  CoverArt（程序化封面）/ ProjectCard / FilterBar / CommandPalette / SiteHeader / Marquee
  pages/       HomePage / ProjectPage / SubmitPage / AboutPage
  styles/      tokens.css（设计令牌）/ global.css
scripts/       fetch-github.mjs（真实数据）/ verify-ui.mjs（运行时验证）
docs/          self-grill.md（设计核对与已知边界）
screenshots/   运行时验证截图
```

## 第一版已知边界

- 没有后端：提交页只在本地生成符合 schema 的 JSON，需要人工贴进 Issue/PR。
- 示例数据不是真实作者：`src/data/seed.ts` 的 16 条是演示条目，界面上全部标了「示例」。
- GitHub 快照会过期：`github-live.json` 带 `fetchedAt`，页面显示抓取时间；更新就重跑脚本。
- GitHub 分类是启发式：`guessCategory()` 按关键词猜测，可能不准；条目出处始终可回溯到仓库。
- 未做：账号体系、真实上传、点赞写回、i18n、分页。
