# scripts

## `fetch-github.mjs`

把公开 GitHub 搜索快照写进 `src/data/github-live.json`，页面启动时优先读取它。

```powershell
npm run fetch:github          # 默认 limit=24
node scripts/fetch-github.mjs --limit=40
$env:GITHUB_TOKEN = "ghp_…"; npm run fetch:github   # 可选，提高匿名限流
```

规则：

- 只读取公开仓库元数据（名称、简介、stars、topics、owner、链接），不下载仓库内容。
- 过滤掉 awesome-list / 教程 / 资源合集类仓库，只保留看起来是“作品”的条目。
- `story` 字段原样保留仓库自述并在前面标注“仓库自述（原文）”，不编造创作过程。
- 无 token 时 GitHub 搜索接口限流约 10 次/分钟；脚本已内置 2.5s 间隔与失败跳过。
- 抓取失败时**不会**清空已有快照，只是以非零退出码退出。
