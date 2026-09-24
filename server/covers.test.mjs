// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { coverKey, createCoverCache } from './covers.mjs'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS3sAAAAASUVORK5CYII=', 'base64')

function tempDir() {
  return mkdtempSync(path.join(tmpdir(), 'vh-covers-'))
}

describe('coverKey', () => {
  it('接受正常的 owner/repo，生成安全文件名', () => {
    expect(coverKey('xintaofei', 'codeg')).toBe('xintaofei__codeg')
    expect(coverKey('LingyiChen-AI', 'AIComicBuilder')).toBe('LingyiChen-AI__AIComicBuilder')
  })

  it('拒绝路径穿越与非法字符', () => {
    expect(coverKey('..', 'codeg')).toBeNull()
    expect(coverKey('owner', '../../etc')).toBeNull()
    expect(coverKey('owner/name', 'repo')).toBeNull()
    expect(coverKey('', 'repo')).toBeNull()
    expect(coverKey('owner', 'repo name')).toBeNull()
  })
})

describe('createCoverCache', () => {
  it('拒绝 HTML、超大响应和上游重定向，不把错误页缓存成图片', async () => {
    const dir = tempDir()
    try {
      for (const response of [new Response('<html>error</html>'), new Response(PNG, { status: 302 }),
        new Response(PNG, { headers: { 'content-length': '99999999' } })]) {
        const cache = createCoverCache({ dir, fetchImpl: async () => response })
        expect(await cache.get('owner', 'repo')).toBeNull()
      }
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
  it('首次从上游抓取并落盘，第二次直接命中缓存不再请求上游', async () => {
    const dir = tempDir()
    try {
      const fetchImpl = vi.fn(async () => new Response(PNG, { status: 200 }))
      const cache = createCoverCache({ dir, fetchImpl })

      const first = await cache.get('xintaofei', 'codeg')
      expect(first).toMatchObject({ contentType: 'image/png', cached: false })
      expect(Buffer.compare(first.body, PNG)).toBe(0)

      const second = await cache.get('xintaofei', 'codeg')
      expect(second).toMatchObject({ cached: true })
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(Buffer.compare(second.body, PNG)).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('并发请求同一张封面只打一次上游', async () => {
    const dir = tempDir()
    try {
      const fetchImpl = vi.fn(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(new Response(PNG, { status: 200 })), 30)),
      )
      const cache = createCoverCache({ dir, fetchImpl })

      const results = await Promise.all([
        cache.get('owner', 'repo'),
        cache.get('owner', 'repo'),
        cache.get('owner', 'repo'),
      ])

      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(results.every((item) => item && Buffer.compare(item.body, PNG) === 0)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('上游失败或返回非 200 时返回 null，且不写出损坏缓存', async () => {
    const dir = tempDir()
    try {
      const cache = createCoverCache({
        dir,
        fetchImpl: async () => new Response('nope', { status: 502 }),
      })

      expect(await cache.get('owner', 'repo')).toBeNull()

      const okCache = createCoverCache({
        dir,
        fetchImpl: async () => new Response(PNG, { status: 200 }),
      })
      const after = await okCache.get('owner', 'repo')
      expect(after).toMatchObject({ cached: false })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('非法仓库名不发请求', async () => {
    const dir = tempDir()
    try {
      const fetchImpl = vi.fn()
      const cache = createCoverCache({ dir, fetchImpl })

      expect(await cache.get('../..', 'etc')).toBeNull()
      expect(fetchImpl).not.toHaveBeenCalled()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
