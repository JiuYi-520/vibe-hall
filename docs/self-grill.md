# 自行 grill：分支记录（v0.1）

按 grill-me 的 self-grill 模式逐分支收口；每条给出结论、依据与当前状态。

## 1. 范围与形态

- 问题：这是新项目、新子系统，还是小改动？
  结论：architectural（新项目，仓库里没有任何既有流程可改）。状态：evidence-resolved。
- 问题：是否要先出设计稿再实现？
  结论：否。用户明确说“自行 grill，给我做出来第一版”，已授权直接实现；因此把设计决策写进本文件与
  README，不额外停在设计审批门。状态：evidence-resolved（用户原话）。
- 问题：前后端形态？
  结论：静态 SPA（Vite + React 19 + TS），`base: './'` + HashRouter，dist 可丢到任意静态托管；
  第一版不做服务端。理由：先证明展馆本身的交互与视觉，再谈写入链路。状态：reversible-default。

## 2. 数据真实性（最高风险分支）

- 问题：示例数据会不会被误认为真实作者的作品？
  结论：不会。数据模型里 `provenance.source` 只有 seed 与 github，卡片与详情页按来源渲染
  「示例」/「GitHub 实时」标记，详情页有独立「数据说明」段落；seed.ts 每条都带
  note“演示示例数据…未指向真实作者的作品”。状态：evidence-resolved（validateProjects.test.ts
  断言 seed 整体通过校验）。
- 问题：GitHub 条目能不能编造创作故事？
  结论：不能。story 字段保存仓库自述原文并加前缀，prompt/iterations 留空，页面相应区块不渲染。
  状态：evidence-resolved（scripts/fetch-github.mjs 的 toProject()）。
- 问题：搜索结果混进 awesome-list / 教程 / 基建仓库怎么办？
  结论：四重过滤 —— STOP_TOPICS 标签黑名单、LISTY/TOOLING 描述正则、VIBE_SIGNAL（vibecoding 关联
  必须能从仓库自身证据看出）、作品特征（有 demo 链接或 stars <= 1200）。状态：evidence-resolved
  （两轮真实抓取对比：24 条工具/合集 -> 14 条更像作品）。
- 问题：抓取失败会不会清空已有快照？
  结论：不会。零结果时只以非零退出码退出，不写文件。状态：reversible-default。

## 3. 交互与视觉

- 问题：什么算“交互高级”？
  结论：⌘K 命令面板（键盘选择 + 高亮 + 滚动跟随）、URL 化筛选状态、FLIP 布局动画、指针驱动 3D
  倾斜与光斑、程序化封面、主题切换（View Transition）。状态：evidence-resolved
  （verify:ui 逐项点击断言 + 截图）。
- 问题：动效会不会影响可访问性？
  结论：prefers-reduced-motion: reduce 时关闭倾斜/漂移/跑马灯/过渡；交互元素是原生 button/link，
  带 aria-pressed、aria-live、可见焦点环与跳过链接。状态：evidence-resolved（verify:ui 的
  reduced-motion 与键盘检查）。
- 问题：中文字体不能联网加载怎么办？
  结论：只用系统字体栈，封面用程序化 SVG/CSS 生成，不依赖任何 CDN 或第三方图片。
  状态：evidence-resolved。
- 问题：同分类的作品封面会不会长得一样？
  结论：第一版会（同类同色相）。已加按 slug 哈希的色相抖动，同分类也不同门面。
  状态：evidence-resolved。

## 4. 验证策略

- 问题：UI 项目怎么证明“真的能跑”？
  结论：三层证据 —— npm test（36 项：数据/筛选/URL/组件行为）、npm run build（tsc + vite）、
  npm run verify:ui（真实 Edge 内核、21 项行为断言、零 console error、多张截图）。
  状态：evidence-resolved。
- 问题：分类筛选真的生效了吗？
  结论：第一版不生效。组件测试抓到 FilterBar 的 categories 补丁键没有映射到 URL 状态键 cats，
  chip 点击被静默丢弃；修复后保留该断言作为回归测试。状态：evidence-resolved（RED->GREEN）。
- 问题：空表单提交会不会静默通过？
  结论：不会。提交页复用 validateProjects，缺字段或非 http(s) 链接会列出具体问题。
  状态：evidence-resolved（verify:ui 的提交表单两项检查）。

## 5. 仍待用户决定（needs-user，不阻塞 v1）

1. 真实投稿通道走 GitHub Issue 模板，还是接收 PR / 后端上传？
2. 是否需要「创作者主页」（按人聚合）与「本日新增」分区？
3. 是否用 GITHUB_TOKEN 定时抓取并部署到具体域名？

未决项按当前默认执行，不影响第一版可用性。

## 6. 优化轮（“优化”指令，先量后改）

原则：先用 `scripts/measure.mjs` 采基线，再改，再用同一脚本复测；量不到差异的改动不当成果汇报。

- 问题：优化什么？
  结论：只锁定“可测量”的四类 —— 首屏体积、DOM 节点数、两个真实缺陷（锚点被顶栏遮挡、命令面板焦点）、
  搜索质量与可访问性；不做没有度量方式的“感觉更快”。状态：evidence-resolved。
- 问题：要不要为了减包把动画库整个去掉？
  结论：去。它的能力可以被更轻的手段覆盖：入场动画用 CSS keyframes（`--i` 错峰）、倾斜与光斑在 DOM 上
  写 CSS 变量（rAF 合并，每帧最多一次写）、筛选切换用原生 View Transitions。实测首屏 JS
  463,011 → 324,116 字节，DOM 2,026 → 1,112。代价：失去逐卡 FLIP 布局动画，换成整页交叉淡入
  （Chromium 支持；不支持时直接切换，不报错）。状态：evidence-resolved，可回滚（父提交 da9f610）。
- 问题：屏外渲染跳过（content-visibility）有效吗？
  结论：本机 34 张卡时强制布局中位数 0.1ms → 0.2ms，**测不出差异**，因此按“为更大目录预留的防御性改动”
  记录，不作为性能成果。状态：evidence-resolved（含负结果）。
- 问题：锚点缺陷是什么？
  结论：HashRouter 下英雄区 `href="#hall"` 会被当成路由跳转，点“进入展馆”实际落到兜底页 /hall。
  现在拦下默认行为改页内滚动，并给 section 加 `scroll-margin-top`，标题不再被 sticky header 遮住。
  状态：evidence-resolved（组件测试 RED→GREEN + 浏览器几何断言 132px > 67px）。
- 问题：命令面板的键盘体验如何？
  结论：加焦点陷阱（Tab 在面板内循环）、关闭后焦点还给打开它的元素、触发按钮 `aria-expanded`。
  注意 `autoFocus` 会在提交阶段先抢焦点导致“记错来源”，因此改成先记录再显式聚焦。
  状态：evidence-resolved（单测 + 浏览器内 20 次 Tab 断言）。
- 问题：搜索只是子串匹配，够用吗？
  结论：不够。加相关性打分（标题 > 标签/技术栈/作者 > 简介 > 故事，标题前缀加权最高），并列时沿用用户
  选择的排序，并在结果里高亮命中词。状态：evidence-resolved。
- 问题：精选位是不是被同类霸榜？
  结论：会。改成 `pickFeatured` 先每分类各占一席再按热度补齐；现在精选四条分属四个分类。状态：evidence-resolved。
- 问题：真实无障碍状况如何？
  结论：接入 axe-core（wcag2a/2aa/21a/21aa）在深色与浅色各扫一遍。第一轮扫出两处真实对比度不足
  （英雄区统计标签、浅色工具栏与页脚），已调整设计令牌；现在深浅色均 0 条严重问题。状态：evidence-resolved。
- 问题：优化会不会改坏既有行为？
  结论：不会。50/50 单元与组件测试、33/33 浏览器运行时检查、零 console error，提交前仍跑
  `npm run build`（tsc + vite）并复核截图。状态：evidence-resolved。
- 问题：还有没测到的地方？
  结论：首次内容渲染没有优化前的基线数据，因此不声称渲染提速；移动端只验了渲染与卡片存在性，
  没做真机手势/滚动性能测试；GitHub 条目的分类仍是启发式。状态：deferred（不阻塞）。

## 7. 愿望墙与接单（本轮）

- 问题：“加一个想要的愿望描述，接单”是给展馆加什么？
  结论：加需求侧 —— 一面愿望墙：贴「我想要一个能…的东西」→ 别人「我来接单」→ 做完关联展品变「已交付」。
  与大厅（作品侧）互为两端，详情页不新增冗余入口。状态：evidence-resolved（用户原话）。
- 问题：没有后端，怎样才不算骗人？
  结论：三个必须：① 顶部明文写「只存在这台浏览器、别人看不到」；② 卡片按来源标「本机 / 示例」；
  ③ 提供「导出 JSON」把本机内容交给维护者。同时存储损坏时回落到空改动、绝不白屏。
  状态：evidence-resolved（界面文案 + `wishBoard.test.ts` 的损坏存储用例）。
- 问题：状态机怎么定才不会互相踩？
  结论：只允许 待接单 →(接单)→ 已接单 →(交付)→ 已交付；重复接单、接已交付、非接单人交付、
  交付缺作品与链接，四种非法转移各返回明确原因码并转成中文提示。状态：evidence-resolved
  （`wishes.test.ts` 16 项 + 页面 8 项）。
- 问题：接单/交付用弹窗还是就地展开？
  结论：就地展开。弹窗会丢掉“这是哪条愿望、谁接的”上下文；就地展开同时让键盘顺序自然、
  少一层焦点管理。状态：evidence-resolved（截图 + 40 项运行时检查）。
- 问题：本地贴的愿望能不能被接单？
  结论：第一版**不能** —— `applyPatch` 只把接单/交付/想要叠加到种子愿望，忽略 `patch.created`。
  浏览器端到端检查（贴 → 接单 → 交付）把它暴露出来，已改为种子与本机愿望走同一条叠加路径，
  并补了两条回归测试。状态：evidence-resolved（RED→GREEN）。
- 问题：还有什么没做到？
  结论：没有身份验证，接单人是自证；没有多人同步（本机存储）；愿望不能删除/编辑；
  愿望与展品的关联是单向的（展品详情页还没反查“来自哪条愿望”）。状态：deferred（不阻塞）。
