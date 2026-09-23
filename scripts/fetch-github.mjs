/**
 * Builds src/data/github-live.json from public GitHub search results.
 *
 * Honest-by-construction: every record keeps its repository url, star count,
 * topics and the fetch timestamp. Nothing is invented — the "story" field is the
 * repository description verbatim, prefixed so the UI can label it as such.
 *
 * Usage: node scripts/fetch-github.mjs [--limit 24]
 * Optional: set GITHUB_TOKEN to raise the anonymous rate limit.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? 24)
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/github-live.json')
const HISTORY_OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/github-history.json')
const MAX_SNAPSHOTS = 180
const UA = 'vibe-hall-fetch'

const QUERIES = [
  { q: 'topic:vibe-coding stars:2..4000', label: 'topic:vibe-coding' },
  { q: '"vibe coded" app in:description,readme stars:3..3000', label: 'vibe coded app' },
  { q: '"vibe coding" app OR game OR website OR portfolio in:description stars:3..2000', label: 'vibe coding work' },
  { q: '"vibe coded" site OR game OR tool in:description stars:1..600', label: 'vibe coded indie work' },
  { q: 'topic:built-with-claude stars:2..3000', label: 'topic:built-with-claude' },
]

const STOP_TOPICS = new Set(['awesome', 'awesome-list', 'curated-list', 'resources', 'learning-resources'])
const LISTY =
  /(awesome|curated|list of|项目列表|合集|资源|roadmap|cheat ?sheet|course materials|教程|指南|handbook|directory|galaxy|collection|newsletter)/i
const TOOLING =
  /(toolkit|framework|engine|platform|sdk|\bapi\b|marketplace|plugin|extension|harness|boilerplate|template|starter|\bcli\b|library|monorepo|infrastructure)/i
const ARTIFACT =
  /(\bapp\b|application|website|\bsite\b|portfolio|\bgame\b|\btool\b|dashboard|visuali[sz]er|clone|landing|demo|web ?app|toy|startpage|generator|builder|游戏|网页|作品|应用|网站|看板|课?件|平台)/i
/** The "vibecoding" claim itself must be sourced from the repo, never assumed. */
const VIBE_SIGNAL =
  /(vibe[- ]?cod|vibe coding|lovable|bolt\.new|windsurf|cursor|claude|codex|ai[- ]?(built|generated|assisted|powered)|\bgpt\b|\bllm\b)/i

function headers() {
  const base = { 'User-Agent': UA, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  return process.env.GITHUB_TOKEN ? { ...base, Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : base
}

async function search(query) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=30`
  const response = await fetch(url, { headers: headers() })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub search failed ${response.status} for "${query}": ${body.slice(0, 200)}`)
  }
  const json = await response.json()
  const remaining = response.headers.get('x-ratelimit-remaining')
  console.log(`  · ${query} → ${json.items?.length ?? 0} items (rate limit remaining: ${remaining})`)
  return json.items ?? []
}

function guessCategory(repo) {
  const blob = `${repo.name} ${repo.description ?? ''} ${(repo.topics ?? []).join(' ')}`.toLowerCase()
  if (/(game|pixel|roguelike|arcade|游戏|rpg|minecraft|physics|maze)/.test(blob)) return 'game'
  if (/(education|learn|course|school|teaching|classroom|教学|教育|study|quiz)/.test(blob)) return 'education'
  if (/(dashboard|analytics|chart|data ?viz|visuali[sz]ation|metric|看板|数据)/.test(blob)) return 'data'
  if (/(music|audio|synth|sound|podcast|音频|音乐|midi)/.test(blob)) return 'sound'
  if (/(ai|llm|gpt|agent|chatbot|prompt|deepseek|claude|openai)/.test(blob)) return 'ai'
  if (/(portfolio|design|typography|generat|poster|art|creative|canvas|shader|可视|设计)/.test(blob)) return 'visual'
  if (/(tool|cli|productivity|notes|todo|editor|automation|utility|bot|scraper|工具|效率)/.test(blob)) return 'tool'
  return 'life'
}

function toStack(repo) {
  const stack = []
  if (repo.language) stack.push(repo.language)
  for (const topic of repo.topics ?? []) {
    if (stack.length >= 5) break
    if (STOP_TOPICS.has(topic)) continue
    if (/-/.test(topic) && topic.length > 22) continue
    const pretty = topic.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    if (!stack.some((item) => item.toLowerCase() === pretty.toLowerCase())) stack.push(pretty)
  }
  return stack.slice(0, 5)
}

function toProject(repo, queryLabel) {
  const description = (repo.description ?? '').replace(/\s+/g, ' ').trim()
  const links = [{ kind: 'repo', label: '查看源码', url: repo.html_url }]
  if (repo.homepage && /^https?:\/\//i.test(repo.homepage)) {
    links.unshift({ kind: 'demo', label: '打开作品', url: repo.homepage })
  }

  const tags = (repo.topics ?? [])
    .filter((topic) => !STOP_TOPICS.has(topic))
    .slice(0, 4)
    .map((topic) => topic.replace(/-/g, ' '))

  return {
    id: `gh-${repo.id}`,
    slug: repo.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    title: repo.name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    tagline: description ? description.slice(0, 96) : `${repo.full_name}（仓库未填写简介）`,
    story: description ? `仓库自述（原文）：${description}` : `仓库 ${repo.full_name} 未填写简介。`,
    category: guessCategory(repo),
    tags,
    stack: toStack(repo),
    maker: {
      name: repo.owner?.login ?? 'unknown',
      handle: repo.owner?.login ?? 'unknown',
      avatarUrl: repo.owner?.avatar_url,
      url: repo.owner?.html_url,
    },
    links,
    createdAt: repo.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    updatedAt: repo.pushed_at?.slice(0, 10),
    likes: 0,
    stars: repo.stargazers_count ?? 0,
    featured: (repo.stargazers_count ?? 0) > 200,
    status: 'live',
    provenance: {
      source: 'github',
      fetchedAt: new Date().toISOString(),
      query: queryLabel,
      repoFullName: repo.full_name,
      htmlUrl: repo.html_url,
    },
  }
}

function keep(repo) {
  if (repo.archived || repo.disabled || repo.fork) return false
  if (!repo.description) return false
  const topics = repo.topics ?? []
  if (topics.some((topic) => STOP_TOPICS.has(topic))) return false
  const blob = `${repo.name} ${repo.description}`
  if (LISTY.test(blob)) return false
  if (TOOLING.test(blob)) return false
  if (!VIBE_SIGNAL.test(`${blob} ${topics.join(' ')}`)) return false
  const hasDemo = typeof repo.homepage === 'string' && /^https?:\/\//i.test(repo.homepage)
  if (!ARTIFACT.test(blob)) return false
  // Individual works: prefer repos that ship a live url or are not mega projects.
  return hasDemo || (repo.stargazers_count ?? 0) <= 1200
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 星标快照历史：升星榜需要「两次以上快照」才能算出真实增量。
 * 第一次建立历史时，把已有的实时快照（含它自己的 fetchedAt）作为第一个数据点，之后每次抓取追加一条。
 */
async function appendHistory(projects, fetchedAt, previousLive) {
  const existing = await readJson(HISTORY_OUT)
  const snapshots = Array.isArray(existing?.snapshots) ? [...existing.snapshots] : []

  // 第一次建立历史时，把上一份实时快照（它自己的 fetchedAt）当作第一个数据点
  if (snapshots.length === 0) {
    if (previousLive?.fetchedAt && Array.isArray(previousLive.projects)) {
      const repos = {}
      for (const project of previousLive.projects) {
        const fullName = project.provenance?.repoFullName
        if (fullName) repos[fullName] = project.stars ?? 0
      }
      if (Object.keys(repos).length > 0) snapshots.push({ at: live.fetchedAt, repos })
    }
  }

  const repos = {}
  for (const project of projects) {
    const fullName = project.provenance?.repoFullName
    if (fullName) repos[fullName] = project.stars ?? 0
  }

  const last = snapshots[snapshots.length - 1]
  if (!last || last.at !== fetchedAt) snapshots.push({ at: fetchedAt, repos })

  const capped = snapshots.slice(-MAX_SNAPSHOTS)
  await writeFile(
    HISTORY_OUT,
    `${JSON.stringify({ schema: 'vibe-hall.star-history.v1', snapshots: capped }, null, 2)}\n`,
    'utf8',
  )
  console.log(`星标快照历史：共 ${capped.length} 条（升星榜需要至少 2 条）`)
}

async function main() {
  console.log('Fetching public GitHub repositories…')
  const collected = new Map()
  const previousLive = await readJson(OUT)

  for (const { q, label } of QUERIES) {
    try {
      const items = await search(q)
      for (const repo of items) {
        if (!keep(repo)) continue
        if (collected.has(repo.full_name)) continue
        collected.set(repo.full_name, toProject(repo, label))
      }
    } catch (error) {
      console.warn(`  ! skipped query: ${error.message}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 2500))
  }

  const projects = [...collected.values()]
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
    .slice(0, LIMIT)

  if (projects.length === 0) {
    console.error('No repositories collected — keeping the existing snapshot untouched.')
    process.exitCode = 1
    return
  }

  const fetchedAt = new Date().toISOString()
  const payload = {
    fetchedAt,
    query: QUERIES.map((entry) => entry.label).join(' | '),
    count: projects.length,
    projects,
  }

  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${projects.length} live records to ${OUT}`)
  await appendHistory(projects, fetchedAt, previousLive)
}

await main()
