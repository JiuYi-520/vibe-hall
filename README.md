# VIBE HALL · vibecoding 作品展馆（第一版）

一个用来陈列不同创作者的 vibecoding 作品的网站：门牌号、分类、技术栈、一句介绍，
再加上这个展馆最看重的两样东西 —— 关键提示词 和 迭代轨迹。
外加两面：**愿望墙**（贴出「我想要一个能…的东西」→ 别人接单 → 挂回大厅变「已交付」）和
**GitHub 升星榜**（按真实快照统计增量，分技能包 / 软件应用 / 库与框架 / 清单合集，可按日 / 周 / 月 / 全部看）。

## 快速开始

```powershell
npm install
npm run dev            # 开发服务器 http://localhost:5173
npm run build          # 类型检查 + 生产构建（dist/）
npm run preview        # 预览构建产物 http://localhost:4173
npm test               # 97 项单元/组件测试
npm run fetch:github   # 拉取真实 GitHub 作品到 src/data/github-live.json
npm run verify:ui      # 用真实浏览器（Edge）跑 47 项运行时检查并截图
npm run measure        # 采集首屏体积 / DOM / 长任务等指标（可与基线对比）
```

## 性能与预算（优化后实测）

同一台机器、同一套 `scripts/measure.mjs`，生产构建实测：

| 指标 | 优化前 | 优化后 |
| --- | --- | --- |
| 首屏 JS | 463,011 字节（1 个文件） | 324,116 字节（react / router / index 三个并行块） |
| 首屏 JS（gzip） | 150.6 kB | 105.6 kB |
| DOM 节点 | 2,026 | 1,112 |
| 封面 SVG 子节点 | 850 | 0（列表封面改为纯 CSS 渐变） |
| 命令面板响应 | 43 ms | 28 ms |

做法：详情/提交/关于三个页面改成路由级懒加载、vendor 分包、列表封面从内联 SVG 改纯 CSS、
去掉动画库（倾斜与光斑改为在 DOM 上写 CSS 变量，每帧最多一次）、筛选切换用原生 View Transitions 做交叉淡入。

运行时预算守在 `scripts/verify-ui.mjs` 里：首屏 JS ≤ 340,000 字节、CSS ≤ 40,000 字节、DOM ≤ 1,400 节点，超出即失败。

未声称的部分：首次内容渲染时间没有在优化前的构建上采到，因此**不声称渲染提速**；
指针扫描期间前后都是 0 次长任务，所以交互改造在本机不产生可测差异（收益是主线程帧内工作量与内存，不是这台机器上的长任务数）。

## 数据来源（重要）

展馆有两条数据通道，界面上严格区分，不会互相冒充：

| 通道 | 来源 | 卡片标记 | 字段 |
| --- | --- | --- | --- |
| 内置示例 | `src/data/seed.ts`，为展示交互而写 | 示例 | 完整故事、提示词、迭代记录 |
| GitHub 实时 | `npm run fetch:github` 生成的 `src/data/github-live.json` | GitHub 实时 | 仓库公开元数据：名称、简介原文、stars、topics、owner、链接 |
| 星标历史 | 同一个脚本追加的 `src/data/github-history.json` | — | 每次抓取一份 `{时间, 仓库→星标}` 快照，供升星榜算增量 |

`loadProjects()` 合并两者，并用同一套 `validateProjects()` 丢弃结构不合法的实时记录。
GitHub 条目的 story 字段是仓库自述原文（带“仓库自述（原文）”前缀），展馆不替作者编造创作过程；
没有 demo 链接、没有提示词时，详情页只显示元数据与「数据说明」。

## 交互与可访问性

## GitHub 升星榜（`/#/stars`）

三种榜，对应三种可用数据：

| 榜 | 依据 | 什么时候有数 |
| --- | --- | --- |
| 增量榜 | 窗口内最早那份快照与当前星标之差 | 需要窗口内**两次以上**真实快照 |
| 增速榜 | 星标 ÷ 仓库创建至今的天数（日均） | 立刻可用，来自公开元数据 |
| 存量榜 | 当前总星标 | 立刻可用 |

时间窗口：日 / 周 / 月 / 全部（相对最新一次快照计算）。分类：技能包 / 软件应用 / 库与框架 / 清单合集 / 其它，
由名称、简介与 topics 的启发式规则判定。

**不编数据**：GitHub API 只给当前星标，不给历史。窗口内快照不足两次时，增量列显示 `—`、增量榜按钮禁用，
并明确写出原因；两次快照相隔太短导致全为 0 时，也会说明「需要更长间隔」。要看到真实升星趋势，
就定期运行 `npm run fetch:github`（每次追加一条快照，最多保留 180 条）。

## 愿望墙与接单（`/#/wishes`）

愿望墙是展馆的「需求侧」：贴的是**想要什么**，不是成品。

| 状态 | 含义 | 能做什么 |
| --- | --- | --- |
| 待接单 | 还没有人认领 | 任何人都能「我来接单」或「我也想要」 |
| 已接单 | 有人认领并留下了一句话计划 | 只有接单人本人能标记为已交付 |
| 已交付 | 做出来了，并挂上了大厅里的某件展品或外部链接 | 点「看作品」跳到对应展品 |

规则由纯函数实现，测试覆盖完整状态机（`src/data/wishes.ts`）：重复接单、接已交付的、只有名字没账号、
非接单人交付、交付时既没选作品也没填链接——每一种失败都有明确原因码，界面上给出中文提示。

**诚实边界**：第一版没有后端。你贴的愿望、接单和鼓掌只写入**当前浏览器的 localStorage**
（键名 `vibe-hall:wishes`），别人看不到，刷新不丢，「导出 JSON」可以交给维护者正式收录；
界面顶部明确写了这件事，本机条目在卡片上标「本机」，内置条目标「示例」。存储损坏时会回落到空改动而不是白屏。

- `⌘K` / `Ctrl K` 打开快速跳转面板；`/` 聚焦搜索框；`↑ ↓ ↵ Esc` 在面板内导航。
- 筛选状态写进 URL（`#/?cats=game&sort=stars`），可直接分享或刷新还原。
- 卡片跟随指针做 3D 倾斜 + 光斑跟随；网格切换/排序走布局动画（FLIP）。
- 卡片、分类、排序、布局全部是真实按钮/链接，带 `aria-pressed`、`aria-live` 结果数。
- 尊重 `prefers-reduced-motion`：关闭倾斜、漂移、跑马灯与过渡；`prefers-color-scheme` 决定初始主题。

## 目录

```
src/
  data/        types / categories / seed / queries / validateProjects / loadProjects
               wishTypes / wishSeed / wishes（愿望墙状态机与筛选）
               starTypes / stars（升星榜分类与增量统计）/ history（快照历史加载）
  lib/         urlState（URL 状态解析与序列化）/ hooks（主题、快捷键、滚动进度、复制）
               wishBoard（本机存储 + 叠加表 + useWishes）
  components/  CoverArt（程序化封面）/ ProjectCard / FilterBar / CommandPalette / SiteHeader / Marquee
               WishCard（愿望卡：接单与交付就地展开）
  pages/       HomePage / ProjectPage / SubmitPage / AboutPage / WishesPage / StarsPage
  styles/      tokens.css（设计令牌）/ global.css
scripts/       fetch-github.mjs（真实数据）/ verify-ui.mjs（运行时验证）/ measure.mjs（性能指标）
docs/          self-grill.md（设计核对与已知边界）
screenshots/   运行时验证截图
```

## 第一版已知边界

- 没有后端：提交页只在本地生成符合 schema 的 JSON，需要人工贴进 Issue/PR。
- 愿望墙同样没有后端：愿望与接单存在本机 localStorage，别人看不到；也没有身份验证，接单人是自证的。
- 示例数据不是真实作者：`src/data/seed.ts` 的 16 条是演示条目，界面上全部标了「示例」。
- 愿望种子（`src/data/wishSeed.ts` 的 10 条）也是演示数据，标「示例」。
- GitHub 快照会过期：`github-live.json` 带 `fetchedAt`，页面显示抓取时间；更新就重跑脚本。
- 升星榜需要时间：目前只有两次相隔几分钟的快照，所以增量都是 0；要看到真实涨势就定期跑抓取脚本。
- 升星榜分类是启发式：技能包 / 软件应用 / 库与框架 / 清单合集 / 其它由关键词判定，可能不准。
- GitHub 分类是启发式：`guessCategory()` 按关键词猜测，可能不准；条目出处始终可回溯到仓库。
- 未做：账号体系、真实上传、点赞写回、i18n、分页。
