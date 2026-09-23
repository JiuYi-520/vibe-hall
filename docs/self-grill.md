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
