import { mkdir, readFile, stat, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'

const MAX_BYTES = 2 * 1024 * 1024
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const isPng = (body) => body.length >= 24 && body.length <= MAX_BYTES && body.subarray(0, 8).equals(PNG_SIGNATURE)

export function coverKey(owner, repo) {
  if (typeof owner !== 'string' || typeof repo !== 'string' ||
    !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(owner) || !/^[a-z\d_.-]{1,100}$/i.test(repo) || /^\.+$/.test(repo)) return null
  return `${owner}__${repo}`
}

/** Fixed GitHub image origin; one request per repository, bounded bytes/time/concurrency. */
export function createCoverCache({ dir, fetchImpl = fetch, ttlMs = 86_400_000 } = {}) {
  const pending = new Map()
  const failures = new Map()
  async function get(owner, repo) {
    const key = coverKey(owner, repo)
    if (!key) return null
    if (pending.has(key)) return pending.get(key)
    const task = (async () => {
      const file = path.join(dir, `${key}.png`)
      let stale = null
      try {
        const info = await stat(file)
        if (info.size <= MAX_BYTES) {
          const body = await readFile(file)
          if (isPng(body)) {
            stale = { body, contentType: 'image/png', cached: true }
            if (Date.now() - info.mtimeMs < ttlMs) return stale
          }
        }
      } catch { /* first fetch */ }
      if (pending.size > 4 || Date.now() < (failures.get(key) ?? 0)) return stale
      try {
        const response = await fetchImpl(`https://opengraph.githubassets.com/1/${owner}/${repo}`, {
          signal: AbortSignal.timeout(12_000), redirect: 'error',
        })
        if (response.status !== 200 || Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('invalid image response')
        const chunks = []
        let size = 0
        for await (const chunk of response.body) {
          size += chunk.length
          if (size > MAX_BYTES) throw new Error('image too large')
          chunks.push(chunk)
        }
        const body = Buffer.concat(chunks)
        if (!isPng(body)) throw new Error('not a PNG')
        await mkdir(dir, { recursive: true })
        const temporary = `${file}.${process.pid}.tmp`
        await writeFile(temporary, body)
        await rename(temporary, file)
        failures.delete(key)
        return { body, contentType: 'image/png', cached: false }
      } catch {
        failures.set(key, Date.now() + 60_000)
        return stale
      }
    })()
    pending.set(key, task)
    try { return await task } finally { pending.delete(key) }
  }
  return { get }
}
