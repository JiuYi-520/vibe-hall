import { readFile, writeFile, mkdir, rename, open, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))
const count = (value) => Number.isSafeInteger(value) && value >= 0

/** All-or-nothing collection of the existing catalogue. Never fabricate missing measurements. */
export async function collectStats({ catalogue, history = { snapshots: [] }, output, fetchImpl = fetch, delayMs = 1100 } = {}) {
  const names = [...new Set(catalogue.projects.filter((p) => p.provenance?.source === 'github').map((p) => p.provenance.repoFullName))]
  if (!names.length || names.length > 40 || names.some((name) => !/^[a-z\d-]+\/[a-z\d_.-]+$/i.test(name))) throw new Error('Invalid catalogue')
  await mkdir(path.dirname(output), { recursive: true })
  const lock = await open(`${output}.lock`, 'wx')
  try {
    const existing = await readJson(output).catch((error) => { if (error.code === 'ENOENT') return history; throw error })
    if (!Array.isArray(existing.snapshots)) throw new Error('Invalid history')
    const repos = {}, forks = {}, languages = {}
    const startedAt = new Date().toISOString()
    for (const name of names) {
      const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'vibe-hall-stats', 'X-GitHub-Api-Version': '2022-11-28' }
      if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
      const response = await fetchImpl(`https://api.github.com/repos/${name}`, { headers, signal: AbortSignal.timeout(20_000) })
      if (!response.ok) throw new Error(`GitHub ${response.status} for ${name}; previous snapshot preserved`)
      const repo = await response.json()
      if (repo.full_name?.toLowerCase() !== name.toLowerCase() || !count(repo.stargazers_count) || !count(repo.forks_count) ||
        !(repo.language === null || typeof repo.language === 'string')) throw new Error(`Invalid GitHub metrics for ${name}`)
      repos[name] = repo.stargazers_count
      forks[name] = repo.forks_count
      languages[name] = repo.language
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    const at = new Date().toISOString()
    // Hourly samples retained for 90 days; preserves raw measurements, not synthetic daily points.
    const snapshots = [...existing.snapshots, { at, startedAt, repos, forks, languages }].slice(-2160)
    const result = { schema: 'vibe-hall.github-stats.v2', source: 'GitHub REST API', snapshots }
    const temporary = `${output}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(result) + '\n')
    await rename(temporary, output)
    return { count: names.length, snapshots: snapshots.length, at }
  } finally { await lock.close(); await unlink(`${output}.lock`) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.env.HALL_STATS_FILE || path.join(root, 'server/github-stats.json')
  const result = await collectStats({ catalogue: await readJson(path.join(root, 'src/data/github-live.json')),
    history: await readJson(path.join(root, 'src/data/github-history.json')), output })
  console.log(JSON.stringify(result))
}
