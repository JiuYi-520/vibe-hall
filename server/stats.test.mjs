// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { collectStats } from '../scripts/collect-github-stats.mjs'
import { startServer } from './app.mjs'

const catalogue = { projects: [{ provenance: { source: 'github', repoFullName: 'a/app' } }] }
describe('真实采集与 HTTP 接线', () => {
  it('保留旧快照，写入 GitHub 的 stars/forks/language，HTTP 不用重启即可读新文件', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vh-stats-'))
    const file = path.join(dir, 'stats.json')
    const history = { snapshots: [{ at: '2026-09-01T00:00:00Z', repos: { 'a/app': 7 } }] }
    let hall
    try {
      await collectStats({ catalogue, history, output: file, delayMs: 0, fetchImpl: async (url) => {
        expect(url).toBe('https://api.github.com/repos/a/app')
        return Response.json({ full_name: 'a/app', stargazers_count: 10, forks_count: 2, language: 'Go' })
      } })
      const saved = JSON.parse(readFileSync(file, 'utf8'))
      expect(saved.snapshots).toHaveLength(2)
      expect(saved.snapshots[1]).toMatchObject({ repos: { 'a/app': 10 }, forks: { 'a/app': 2 }, languages: { 'a/app': 'Go' } })
      hall = await startServer({ port: 0, file: ':memory:', statsFile: file })
      const response = await fetch(`${hall.url}/api/github-stats`)
      expect(response.status).toBe(200)
      expect((await response.json()).snapshots[1].repos['a/app']).toBe(10)
      saved.snapshots[1].repos['a/app'] = 11
      writeFileSync(file, JSON.stringify(saved))
      expect((await (await fetch(`${hall.url}/api/github-stats`)).json()).snapshots[1].repos['a/app']).toBe(11)
    } finally { await hall?.close(); rmSync(dir, { recursive: true, force: true }) }
  })
  it('限流/部分失败不覆盖最后好数据，也不改旧快照时间', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vh-stats-'))
    const file = path.join(dir, 'stats.json')
    writeFileSync(file, '{"snapshots":[]}')
    try {
      await expect(collectStats({ catalogue, output: file, delayMs: 0,
        fetchImpl: async () => new Response('limited', { status: 429 }) })).rejects.toThrow(/429/)
      expect(readFileSync(file, 'utf8')).toBe('{"snapshots":[]}')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
  it('只允许已收录仓库请求封面，真实 HTTP 返回图片', async () => {
    const hall = await startServer({ port: 0, file: ':memory:', coverRepos: ['a/app'],
      coverCache: { get: async () => ({ contentType: 'image/png', body: Buffer.from('image') }) } })
    try {
      const image = await fetch(`${hall.url}/api/cover/a/app`)
      expect(image.status).toBe(200)
      expect(image.headers.get('content-type')).toBe('image/png')
      expect(await image.text()).toBe('image')
      expect((await fetch(`${hall.url}/api/cover/unknown/repo`)).status).toBe(404)
    } finally { await hall.close() }
  })
})
